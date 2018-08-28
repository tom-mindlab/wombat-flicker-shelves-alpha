/* global $ */

import './visual-search-t.less';
import { screen, utils, controls } from 'wombat';
import template from './visual-search-t.html';
import languages from './lang.json';


import shelf_classes from './shelf_classes.json';
import { ShelfRack } from './shelf_rack';
import { $newLayout } from './shelf_rack';
import { TransitionHandler } from './transitions';

function onClick($element) {
	return new Promise(function (resolve) {
		$element.on('click', async (e) => {
			resolve(e);
		});
	});
}

async function showScreen($DOM, replacements) {
	$DOM.fadeIn(200);

	$DOM.find('.message').text(replacements.message);
	$DOM.find('.continue').val(replacements.continue_button);

	await onClick($DOM.find('.continue'));
	return await $DOM.fadeOut(200);
}

// //////////////////////////////////////////////////////////////
// MAIN SCRIPT LOOP                                            //
// //////////////////////////////////////////////////////////////
// args:
// 	[0]: $DOM			:	object (jQuery element)
//			the jQuery DOM element handle to the .main div
// 	[1]: configuration	:	object (parsed json)
// return:
// 		array
// desc:
// 		the main stimuli display and input recording loop, generates shelves on the fly from the config
// 		and records user input (which it returns as an array)
async function main($DOM, configuration, pause, pause_replacements) {
	const rack_dimensions = {
		x: $DOM.find(`.content`).width(),
		y: $DOM.find('.stimuli').height()
	}
	const rack = new ShelfRack(configuration.layout, { shelves: shelf_classes.shelves, products: configuration.product_classes }, rack_dimensions);
	const click_data = [];

	const specific_product = (transition_list) => {
		if (transition_list.enabled_count !== 0) {
			return true;
		} else {
			return false;
		}
	}


	const pause_experiment = async function (reset_timer, requested_product, transition_list) {
		reset_timer ? timer.stop() : timer.pause();
		$DOM.fadeOut(configuration.timer.reset_duration / 2);
		await showScreen(pause, pause_replacements);

		await Promise.all(
			[
				reset_timer ? timer.resetAsync() : async () => { },
				$DOM.fadeIn(configuration.timer.reset_duration).promise(),
				reset_timer ? (async () => {
					if (configuration.repeat_behavior.triggers.timeout === true) {
						if (configuration.repeat_behavior.rearrange === true) {
							transition_list.stop();
							$stimuli.empty();
							await rack.generateBoundedProducts();
							$stimuli.append(await $newLayout($stimuli, rack, configuration.mouseover_classes, specific_product(transition_list)));
							transition_list.setTarget($('img[data-product-type^="' + requested_product.split('-')[0] + '"]').eq(Math.floor(Math.random() * $('img[data-product-type^="' + requested_product.split('-')[0] + '"]').length)));
							transition_list.start();
							await new Promise(res => setTimeout(res, configuration.transition_behavior.duration / 2));

						}
					}
				})() : async () => { }
			]);

		reset_timer ? timer.start() : timer.unpause();
	}

	const timer = controls.timer($DOM.find('.timer'));
	timer.duration(configuration.timer.duration);
	timer.resetDuration(configuration.timer.reset_duration);

	const pause_button = controls.pause($DOM.find('.pause-button'));
	pause_button.click(async () => pause_experiment(false, undefined));


	$DOM.show();
	const $stimuli = $DOM.find('.stimuli');
	const $instruction = $DOM.find('.instruction');

	const trial_count = controls.progress($DOM.find('.progress'));
	trial_count.setTotal(configuration.iterations);
	trial_count.update(0);


	$stimuli.append(`<div class="loading-stimuli">Loading images, please wait...</div>`);
	// MAIN LOOP
	for (let i = 0, repeat = 0, requested_product; i < configuration.iterations; repeat === 0 ? ++i : i) {

		await rack.generateBoundedProducts();
		$stimuli.find(`.loading-stimuli`).hide();

		$stimuli.append(await $newLayout($stimuli, rack, configuration.mouseover_classes));
		$stimuli.hide();

		if (repeat === 0 || configuration.repeat_behavior.new_target === true) {
			requested_product = $('.product').eq(Math.floor(Math.random() * $('.product').length)).attr('data-product-type');
		}

		if (configuration.repeat_behavior.rearrange === true) {
			requested_product = $('img[data-product-type^="' + requested_product.split('-')[0] + '"]').eq(Math.floor(Math.random() * $('img[data-product-type^="' + requested_product.split('-')[0] + '"]').length)).attr('data-product-type');
		}

		const transition_handler = new TransitionHandler($DOM.find('.stimuli'), $('img[data-product-type="' + requested_product + '"]'), configuration.transition_behavior.css, configuration.transition_behavior.cycle_time, configuration.transition_behavior.duration, configuration.transition_behavior.cover_between);
		if (transition_handler.enabled_count == 0) {
			throw new Error("No transitions defined for flicker shelves");
		}

		timer.timeout(async () => {
			await pause_experiment(true, requested_product, transition_handler);
		});

		const desired_product = (product_class, transition_list) => {
			const product_name = product_class.split(`-`)[0];
			if (transition_list.enabled_count !== 0) {
				return `changing product`;
			} else {
				return `${product_name}`;
			}
		}

		const request_message = `Please click on the ${desired_product(requested_product, transition_handler)}`;
		transition_handler.start();

		$instruction.text(request_message);
		$stimuli.fadeIn(configuration.timer.reset_duration);
		$instruction.fadeIn(configuration.timer.reset_duration);
		timer.start();
		const click_info = {
			m_pos: {
				x: NaN,
				y: NaN
			},
			product_type: {
				requested: (transition_handler.enabled_count !== 0) ? requested_product : requested_product.split('-')[0],
				clicked: null
			},
			time_taken: NaN
		};

		const event_info = await onClick($stimuli);

		transition_handler.stop();

		const $target = $(event_info.target);
		click_info.m_pos.x = event_info.pageX;
		click_info.m_pos.y = event_info.pageY;
		click_info.product_type.clicked = $target.attr('data-product-type');
		if (typeof click_info.product_type.clicked === 'undefined') {
			click_info.product_type.clicked = `none`;
		}
		click_info.product_type.clicked = (transition_handler.enabled_count !== 0) ? click_info.product_type.clicked : click_info.product_type.clicked.split('-')[0];

		timer.stop();
		click_info.time_taken = timer.value();
		click_data.push(click_info);


		// repeat triggers
		if (configuration.repeat_behavior.triggers.wrong_answer) {
			if (click_info.product_type.requested != click_info.product_type.clicked) {
				++repeat;
			} else {
				repeat = 0;
				trial_count.update(i + 1);
			}
		}
		if (configuration.repeat_behavior.continue_at > 0) {
			if (repeat % configuration.repeat_behavior.continue_at === 0) {
				repeat = 0;
				trial_count.update(i + 1);
			}
		}

		$instruction.empty();
		$stimuli.empty();
		await timer.resetAsync();
	}

	return click_data;
}

// //////////////////////////////////////////////////////////////
// ENTRY POINT (DEFAULT EXPORTED FUNCTION)                     //
// //////////////////////////////////////////////////////////////
// args:
// [0]: configuration	:	object (parsed json)
//		the .json data passed into the component, see the examples
// [1]: callback		: 	function
// 		the function to execute on element completion, expects two parameters:
//		[0]: meta		:	object
//			 the meta data which will be written to the user's session objects (maintained between elements)
//		[1]: data		:	array
//			 the data produced by the user running through the element
export default async function (configuration, callback) {
	// language
	const lang = Object.assign({}, utils.buildLanguage(languages, configuration), configuration.language_options);

	$('head').append('<style>.product { transition: filter ' + configuration.transition_behavior.duration + 'ms linear; }</style>')

	const $DOM = $(template).clone();
	const $intro_screen = $DOM.find('.introduction').hide();
	const $pause_screen = $DOM.find('.pause-screen').hide();
	const $main = $DOM.find('.main').hide();

	const $title = $DOM.find('.title');
	$title.find('.header').text(lang.title.header);
	$title.find('.message').text(lang.title.message);

	screen.enter($DOM, 'fade');

	await showScreen($intro_screen, lang.screens.intro);

	const meta = null;
	const data = await main($main, configuration, $pause_screen, lang.screens.pause);

	screen.exit('fade', async function () {
		callback(meta, data);
	});
}
