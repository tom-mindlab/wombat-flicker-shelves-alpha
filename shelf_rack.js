/* global $ */

// cant be bothered to implement fisher-yates
import ldShuffle from 'lodash/shuffle'
import ldCloneDeep from 'lodash/cloneDeep'

class Item {
	constructor(name, path) {
		this.name = name;
		this.path = path;
	}
}

class Product extends Item {
	constructor(json_product_class) {
		const product_class = ldCloneDeep(json_product_class);
		super(product_class.name, product_class.path);
		this.dimensions = product_class.dimensions;
		this.resolved_dimensions = product_class.resolved_dimensions;
		this.resolved_dimensions.x;
		this.counts = product_class.counts;
		this.image = product_class.image;
	}
}

// TODO:
// all of these
const OVERFLOW_CALLBACKS = {
	SQUASH: function () { },
	OVERWRITE: {
		LEFT: function () { },
		RIGHT: function () { }
	},
	FAIL: function () { }
};

class Shelf extends Item {
	constructor(json_shelf_obj, overflow_callback) {
		const shelf_class = ldCloneDeep(json_shelf_obj);
		super(shelf_class.name, shelf_class.path);
		this.overflow_callback = overflow_callback;
		this.bounds = shelf_class.bounds;
		this.image = shelf_class.image;
		this.item_groups = [];
	}

}

export class ShelfRack {
	constructor(layout_arr, item_classes, dimensions) {
		this.layout_arr = layout_arr;
		this.product_classes = item_classes.products;
		this.shelf_classes = item_classes.shelves;
		this.dimensions = dimensions;
	}

	tallestProduct() {
		let largest_product = this.product_classes[0];
		for (const product of this.product_classes) {
			if (product.dimensions.y > largest_product.dimensions.y) {

				largest_product = product;
			}
		}
		return largest_product;
	}

	async generateBoundedProducts() {

		if (typeof this.items === "undefined") {
			this.items = await parseItems(this.layout_arr, [], this.shelf_classes);
		}
		// if shelf dimensions haven't already been resolved, do this now
		// clear the current products out here too
		for (const shelf of this.items) {

			if (typeof shelf.dimensions == "undefined") {
				shelf.dimensions = await imageDimensions(shelf.image);
				shelf.resolved_dimensions = {
					x: this.dimensions.x,
					y: this.dimensions.y / this.items.length
				};
				shelf.bounded_dimensions = {
					x: shelf.resolved_dimensions.x,
					y: shelf.resolved_dimensions.y - (((shelf.bounds.top * shelf.dimensions.y) / 100) + ((shelf.bounds.bottom * shelf.dimensions.y) / 100))
				}
			}

			shelf.item_groups = [];
		}

		for (const product of this.product_classes) {
			if (typeof product.image == "undefined") {
				product.image = await loadImage(product.path);
			}
			if (typeof product.dimensions == "undefined") {
				product.dimensions = await imageDimensions(product.image);
			}
		}
		// if product dimensions haven't already been resolved, do this now
		const tallest_height = (() => {
			let tallest_height = 0;
			for (const product of this.product_classes) {
				if (product.dimensions.y > tallest_height) {
					tallest_height = product.dimensions.y;
				}
			}
			return tallest_height;
		})();
		const scale_factor = Math.min(this.items[0].bounded_dimensions.y, tallest_height) / Math.max(this.items[0].bounded_dimensions.y, tallest_height); // how much we had to scale the tallest product to fit
		for (const product of this.product_classes) {
			product.resolved_dimensions = {
				x: product.dimensions.x * scale_factor,
				y: product.dimensions.y * scale_factor
			};
			product.image.width = product.resolved_dimensions.x;
			product.image.height = product.resolved_dimensions.y;
		}

		const product_groups = [];
		const groupProductWidth = (group) => {
			return group[0].resolved_dimensions.x;
		}
		const groupWidth = (group) => {
			return (group[0].image.width * group.length);
		};

		const remainingWidth = (shelf, used_width) => {
			return shelf.bounded_dimensions.x - used_width;
		};

		// generate mandatory products
		for (const product of this.product_classes) {
			// products with a minimum count are considered mandatory
			// push these products within the range of min to max
			// if max is undefined, only min will be added in this stage
			if (typeof product.counts != "undefined" && typeof product.counts.min != "undefined") {
				const max = (typeof product.counts.max != "undefined") ? product.counts.max : product.counts.min;
				if (max < product.counts.min) {
					throw new Error("Minimum product count is higher than maximum");
				}
				product_groups.push(Array(product.counts.min).fill(new Product(product)));
			}
		}

		// distribute what we have randomly between the shelves
		// do this by attempting to push to shelves in a random order
		// if no shelf could accomodate the group, this is considered a fail case (not all requirements in the config could be met)
		const tryRandomPushToShelves = (p_group) => {
			const target_shelves = (() => {
				const target_shelves = [];
				for (let i = 0; i < this.items.length; ++i) {
					target_shelves.push(i);
				}
				return ldShuffle(target_shelves);
			})();
			for (const shelf_index of Object.values(target_shelves)) {

				const used_width = (shelf) => {
					let used_width = 0;
					for (const p_group of shelf.item_groups) {
						used_width += groupWidth(p_group);
					}
					return used_width;
				};

				if ((this.items[shelf_index].bounded_dimensions.x - used_width(this.items[shelf_index])) >= groupWidth(p_group)) {
					this.items[shelf_index].item_groups.push(p_group);
					return true;
				}
			}
			return false;
		}

		for (const p_group of product_groups) {
			if (tryRandomPushToShelves(p_group) === false) {
				throw new Error("Shelf configuration cannot accomodate the minimum required products");
			}
		}

		// [x] now essential products are placed, we take measurments to determine how much room we have left to work with
		// [x] leftover room is first filled with one of each unplaced products (chosen randomly)
		// [x] if there is still room, we now randomly upscale any group which is below its maximum, if it has one defined, and on the condition that there is room

		// grab the list of product types we haven't used, make an array of groups size 1; upscale later

		const optional_product_groups = (() => {
			const out = [];
			for (const product of this.product_classes) {
				// check first for the counts field, if this exists, then check for the minimum count - products that fail both are optional and haven't been placed
				if (typeof product.counts == "undefined" || typeof product.counts.min == "undefined") {
					out.push([new Product(product)]);
				}
			}
			return out;
		})();

		const groups_per_shelf = Math.ceil((product_groups.length + optional_product_groups.length) / this.items.length);
		// raise the groups per shelf so groups are evenly distributed (bias towards upper shelves)
		for (const shelf of this.items) {
			if (groups_per_shelf - shelf.item_groups.length > 0) {
				shelf.item_groups = shelf.item_groups.concat(optional_product_groups.splice(0, groups_per_shelf - shelf.item_groups.length));
				const cumulative_width = (groups) => {
					let cumulative_width = 0;
					for (const pg of groups) {
						cumulative_width += groupWidth(pg);
					}
					return cumulative_width;
				};
				if (cumulative_width(shelf.item_groups) > shelf.resolved_dimensions.x) {
					const compareGroupProductWidth = (l, r) => {
						if (l[0].dimensions.x < r[0].dimensions.x) {
							return -1;
						}
						if (l[0].dimensions.x > r[0].dimensions.x) {
							return 1;
						}
						return 0;
					};

					// remove groups in order of size so long as the width of all groups exceeds the shelves width
					// a group may only be removed if it is an optional group
					const groups_by_width = shelf.item_groups.sort(compareGroupProductWidth);
					while (cumulative_width(groups_by_width) > shelf.bounded_dimensions.x) {
						for (const [g_idex, group] of Object.entries(groups_by_width)) {
							if (typeof group[0].counts == "undefined" || typeof group[0].counts.min == "undefined") {
								groups_by_width.splice(g_idex, 1);
								break;
							}
						}
					}
					shelf.item_groups = groups_by_width;
				}
			}
		}

		for (const shelf of this.items) {
			let used_width = (() => {
				let used_width = 0;
				for (const p_group of shelf.item_groups) {
					used_width += groupWidth(p_group);
				}
				return used_width;
			})();

			const upscalableGroups = () => {
				const upscalable_groups = [];
				for (const p_group of shelf.item_groups) {
					if (groupProductWidth(p_group) < remainingWidth(shelf, used_width)) {
						if (typeof p_group[0].counts != "undefined" && typeof p_group[0].counts.max != "undefined") {
							if (p_group.length < p_group[0].counts.max) {
								upscalable_groups.push(p_group);
							}
						} else {
							upscalable_groups.push(p_group);
						}
					}
				}
				return upscalable_groups;
			};

			for (let upscalable_groups = upscalableGroups(); upscalable_groups.length != 0; upscalable_groups = upscalableGroups()) {
				const rnd_group = Math.floor(Math.random() * upscalable_groups.length);
				upscalable_groups[rnd_group].push(upscalable_groups[rnd_group][0]);
				used_width += groupProductWidth(upscalable_groups[rnd_group]);
			}

			shelf.item_groups = ldShuffle(shelf.item_groups);
		}

	}


}


async function parseItems(json_obj, item_arr, shelf_types_arr) {
	if (!Array.isArray(item_arr)) {
		throw new TypeError('parseItems requires an array-type object to build against');
	}
	if (Array.isArray(json_obj)) {
		for (let i = 0; i < json_obj.length; ++i) {
			item_arr = await parseItems(json_obj[i], item_arr, shelf_types_arr);
		}
	} else {
		const definition = Object.assign(json_obj, shelf_types_arr.find(item => item.name === json_obj.name));
		definition.image = await loadImage(definition.path);
		item_arr.push(new Shelf(definition, OVERFLOW_CALLBACKS.FAIL));
	}
	return item_arr;
}

function loadImage(path) {
	return new Promise(res => {
		const img = new Image();
		img.addEventListener('load', () => res(img));
		img.src = path;
	})
}

function imageDimensions(img) {
	return { x: img.width, y: img.height };
}

async function $asElement(kv_item, tallest, rack) {
	const index = kv_item[0];
	const e_item = kv_item[1];
	let $DOM;

	if (e_item instanceof Product) {
		$DOM = $(e_item.image).clone();
		$DOM.addClass('product');
		$DOM.attr('data-product-type', e_item.name + '-' + index);
		const sf = (e_item.dimensions.y / tallest.dimensions.y);
		$DOM.css('height', sf * 100 + '%');
	} else if (e_item instanceof Shelf) {
		$DOM = $('<div></div>');
		$DOM.css('background-image', 'url(' + e_item.path + ')');
		$DOM.css('background-position', 'center');
		$DOM.css('height', 100 / rack.items.length + '%');
		$DOM.css('padding-top', e_item.bounds.top / rack.items.length + '%');
		$DOM.css('padding-bottom', e_item.bounds.bottom / rack.items.length + '%');
		$DOM.addClass('shelf ' + e_item.name);
	} else {
		throw new TypeError('Expected shelf rack item');
	}

	return $DOM;
}

async function $buildDOM(kv_item, tallest, rack) {
	const $DOM = await $asElement(kv_item, tallest, rack);
	if (Array.isArray(kv_item[1].item_groups)) {
		const $product_container = $(`<div class="product-container"></div>`);
		for (const p_group of kv_item[1].item_groups) {
			for (const kv_product of Object.entries(p_group)) {
				$product_container.append(await $buildDOM(kv_product, tallest, rack));
			}
		}
		$DOM.append($product_container);
	}
	return $DOM;
}

// //////////////////////////////////////////////////////////////
// generate new DOM for generated shelf rack                   //
// //////////////////////////////////////////////////////////////
// args:
// 		[0]: $DOM	:	object (jQuery element)
//				the stimuli div element
//		[1]: product_scale	:	number
//				the scale of products on the shelf
// return:
// 		object (jQuery element)
// desc:
//		generates a DOM for a given shelf rack layout, using the input $DOM as a base
//		returns a completed DOM in the <div class="rack"><div class="shelf ...">... style
export async function $newLayout($container_DOM, rack, mouseover_classes) {
	const $rack_DOM = $container_DOM;
	for (const kv_shelf of Object.entries(rack.items)) {
		$rack_DOM.append(await $buildDOM(kv_shelf, await rack.tallestProduct(), rack));
	}

	$rack_DOM.find('.product').each(function () {
		for (const css_class of mouseover_classes) {
			$(this).hover(
				function () {
					$(this).addClass(css_class);
				}, function () {
					$(this).removeClass(css_class);
				}
			);
		}
	});

	$rack_DOM.find(`.shelf`).each(function (shelf_index) {
		const used_width = (() => {
			let used_width = 0;
			for (const p_group of rack.items[shelf_index].item_groups) {
				for (let i = 0; i < p_group.length; ++i) {
					used_width += p_group[i].image.width;
				}
			}
			return used_width;
		})();

		$(this).children(`.product - container`).css(`max - width`, used_width + 200);
	});

	return $rack_DOM;
}
