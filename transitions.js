import ldCloneDeep from 'lodash/cloneDeep'

export class TransitionHandler {
	constructor($rack_DOM, $target, desired_transitions, cycle_time, duration, cover) {

		this.$rack_DOM = $rack_DOM;
		this.$target = $target;
		this.cycle_time = cycle_time;
		this.duration = duration;
		this.cover = cover;
		this.apply = true;
		this.transitions = new Map(Object.entries(desired_transitions));

		this.interval_handle = undefined;
	}

	setTarget($target) {
		this.$target = $target;
	}

	get transitionString() {
		return [...this.transitions].reduce((acc, v) => `${acc} ${v[0]}(${v[1]}) `, ``);
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
			this.$target.css(`filter`, this.transitionString);

		} else {
			this.$target.css(`filter`, ``);
		}
		this.apply = !this.apply;
	}
}