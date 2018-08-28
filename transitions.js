/* global $ */

export class TransitionHandler {
	constructor($rack_DOM, $target, transition_css, cycle_time, duration, cover) {

		$('head').append(`<style>.flicker_target ${JSON.stringify(transition_css).replace(/"(.*?)"/gi, "$1").replace(/,/gi, ";")}</style>`);

		this.$rack_DOM = $rack_DOM;
		this.$target = $target;
		this.cycle_time = cycle_time;
		this.duration = duration;
		this.cover = cover;
		this.apply = true;

		this.interval_handle = undefined;
	}

	setTarget($target) {
		this.$target = $target;
	}

	start() {
		this.interval_handle = setInterval(() => this.doTransitions(), this.cycle_time);
	}

	stop() {
		clearInterval(this.interval_handle);
	}

	doTransitions() {
		if (this.cover === true) {
			this.$rack_DOM.css(`filter`, `opacity(0)`);
			setTimeout(() => {
				this.$rack_DOM.css(`filter`, `opacity(1)`);
			}, this.duration);
		}

		if (this.apply) {
			this.$target.addClass(`flicker_target`)

		} else {
			this.$target.removeClass(`flicker_target`);
		}
		this.apply = !this.apply;
	}
}