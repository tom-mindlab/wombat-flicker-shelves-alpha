import ldCloneDeep from 'lodash/cloneDeep'

function currentFilters($DOM) {
	if ($DOM.css(`filter`) === 'none') {
		return '';
	}
	return $DOM.css(`filter`);
}

class Blur {
	apply($DOM, amount) {
		$DOM.css('filter', `${currentFilters($DOM)} blur(${amount})`);
		console.warn($DOM.css(`filter`))
	}

	unapply($DOM) {
		$DOM.css('filter', currentFilters($DOM).replace(/blur\(.*\)/gi, ''));
	}
}

class Opacity {
	apply($DOM, amount) {
		$DOM.css('filter', `${currentFilters($DOM)} opacity(${amount})`);
	}

	unapply($DOM) {
		$DOM.css('filter', currentFilters($DOM).replace(/opacity\(.*\)/gi, ''));
	}
}

export const available_transitions = {
	'blur': Blur,
	'opacity': Opacity
};

export class TransitionList {
	constructor($DOM, $target, desired_transitions, cycle_time, duration, cover) {

		this.$DOM = $DOM;
		this.$target = $target;
		this.cycle_time = cycle_time;
		this.duration = duration;
		this.cover = cover;
		this.desired_transitions = ldCloneDeep(desired_transitions);
		this.apply = true;

		this.interval_handle = undefined;
	}

	setTarget($target) {
		this.$target = $target;
	}

	get enabled_count() {
		let count = 0;
		for (const properties of Object.values(this.desired_transitions)) {
			if (properties.enabled) {
				count++;
			}
		}
		return count;
	}

	start() {
		this.interval_handle = setInterval(() => this.doTransitions(), this.cycle_time);
	}

	stop() {
		clearInterval(this.interval_handle);
	}

	doTransitions() {
		if (this.cover === true && this.enabled_count > 0) {
			this.$DOM.hide();
			setTimeout(() => {
				this.$DOM.show();
			}, this.duration);
		}

		for (const [transition, properties] of Object.entries(this.desired_transitions)) {
			if (properties.enabled === true) {
				if (typeof available_transitions[transition] == 'function') {
					if (this.apply) {
						available_transitions[transition].prototype.apply(this.$target, properties.amount);
					} else {
						available_transitions[transition].prototype.unapply(this.$target);
					}
				}
			}
		}
		this.apply = !this.apply;
	}
}