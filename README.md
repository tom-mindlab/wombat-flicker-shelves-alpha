# Visual Search (0.9)

A specialised search component which generates shelf layouts on the fly given minimal input.
- No need to pre-generate shelves
- No need for large configurations
- Perfect scaling for screen sizes (no overlaps, no re-organization)

## Input Configuration (general):

- `"iterations"`: How many trials the user must complete.
- `"timer"`: The timer used in the trials
  - `"duration"`: How long the user has to complete each trial
  - `"reset_duration"`: How long it takes for the timer to reset
- `"repeat_behavior"`: The behavior of trial repeats, where a repeat is re-executing the trial (trial index is not incremented)
  - `"triggers"`: What events will cause a trial to repeat
  - `"rearrange"`: Whether a repeat will rearrange the shelf
  - `"new_target"`: Whether the user will be requested to find a different product on repeat
  - `"continue_at"`: The number of repeats before giving up and continuing
- `"transition_behavior"`: The behavior of the transformations we apply to products if we are running an automatic standout. The test is considered a standout if at least one transition has its `enabled` property set to `true`
  - `"cover_between"`: Whether the rack should be covered up during the transition
  - `"cycle_time"`: The interval between application and removal of the transformation(s)
  - `"duration"`: The time taken to transition from no-transform to full-transform
  - `"transitions"`: The transitions which should be applied, all are disabled by default
- `"item_classes"`: The types of object used in the test
  - `"products"`: The types of products that will be displayed
- `"product_info"`: Global attributes about products
  - `"count"`: The number of products to display
  - `"scale"`: The scaling applied to all products
- `"layout"`: The layout of the shelves
- `"language_options"`: Language overrides for specified fields
  - `"screens"`: The supporting screens which are displayed on events
    - `"pause"`: The screen displayed on pause
    - `"intro"`: The introduction screen
  - `"title"`: The top-left text

## Behavior:

- Display intro screen
- Begin main loop:
  - Generate random product layout
    - If a `transition` is defined, this means we are running an automatic standout, so we should request a *specific* product instead of a *class* of product
  - Await user click...
    - On timer duration timeout:
      - Display pause screen
    - On click event:
      - Log click information (see Output section below for content + format)
  - If trials are all done (trial number = `configuration.iterations`), break out of the main loop, return array of click information objects
  - Otherwise, continue
- Send click information array via `DATA` array
  - *(`META` object is always `null`)*
- Exit

## Output:

- `DATA`: An array of `click_info` objects
  - `click_info`: The information recorded when a user clicks a product
    - `m_pos`: The position of the mouse
      - `x`: The horizontal co-ordinates of the mouse (px)
      - `y`: The vertical co-ordinates of the mouse (px)
    - `product_info`: Information about the correctness of the response
      - `requested`: The *requested* product
      - `clicked`: The product actually clicked
    - `time_taken`: The time taken to click a product (ms)
- `META`: An object representing user information to capture for future elements in the experiment *(always `null` for this component)*