/* @flow */

import type { StateAndHelpers, RenderProp, SytheticMoveEvent } from './types';

import React, { Component } from 'react';
import { Animated } from 'react-360';

import { unwrapArray, callAll, noop } from './utils';

const MOVE_INPUT_RANGE = [0, 1];
const negativeValue = new Animated.Value(-1);
const positiveValue = new Animated.Value(1);

type Props = {
  parallaxDegreeLowerBound: number,
  parallaxDegreeUpperBound: number,
  slop: number,
  initialX: number,
  initialY: number,
  onExitSpringFriction: number,
  onExitSpringTension: number,
  flipX: boolean,
  flipY: boolean,
  children: RenderProp,
  render: RenderProp,
  moveOnLatchOnly: boolean,
};

type State = {
  rotation: {
    x: number,
    y: number,
  },
  latched: boolean,
};

/**
 * # Wobbly
 * <h1 align="center">
 *   〰️ wobbly
 *   </br>
 *   <img src="https://user-images.githubusercontent.com/1127238/38072922-8250c22a-32dd-11e8-8259-fb8ea3346dfc.png" alt="wobbly logo" title="wobbly logo" width="100">
 * </h1>
 * <p align="center">parallax all the things in react-360</p>
 * <hr />
 * </br>
 * wobbly manages the state needed to calculate `x, y` rotations for a parallax effect, allowing you to focus the UI, and apply the effect how/where you want.
 */
class Wobbly extends Component<Props, State> {
  /**
   * @type {object}
   *
   * @typedef {object} Props
   *
   * @property {number} [parallaxDegreeLowerBound=-15] - lower rotation degree bound
   * @property {number} [parallaxDegreeUpperBound=15] - upper rotation degree bound
   * @property {number} [slop=0.1] - slop to add to wrapper via prop getter
   * @property {number} [initialX=0] - initial x value in view, between 0 and 1
   * @property {number} [initialY=0] - initial y value in view, between 0 and 1
   * @property {number} [onExitSpringFriction=4] - controls "bounciness"/overshoot of the onExit animation
   * @property {number} [onExitSpringTension=40] - controls speed of onExit animation
   * @property {boolean} [flipX=false] - flip the sign on the x rotation transform style value
   * @property {boolean} [flipY=false] - flip the sign on the y rotation transform style value
   * @property {boolean} [moveOnLatchOnly=false] - only map onMove events to state when "latched"
   * @property {function} [children] - Is called with the StateAndHelpers of wobbly.
   * @property {function} [render] - Is called with the StateAndHelpers of wobbly.
   * @see {@link https://facebook.github.io/react-360/docs/view.html#hitslop|hitSlop react-360 docs}
   */
  static defaultProps = {
    parallaxDegreeLowerBound: -15,
    parallaxDegreeUpperBound: 15,
    slop: 0.1,
    initialX: 0.5,
    initialY: 0.5,
    onExitSpringFriction: 4,
    onExitSpringTension: 40,
    flipX: false,
    flipY: false,
    moveOnLatchOnly: false,
  };

  /**
   * @type {object}
   * @private
   * @property {Object} rotation - state - The current x,y state
   * @property {boolean} latched - state - Whether onMoved events will be mapped to rotation state
   */
  state = {
    rotation: {
      x: new Animated.Value(this.props.initialX),
      y: new Animated.Value(this.props.initialY),
    },
    latched: this.props.moveOnLatchOnly ? false : true,
  };

  interpolateMoveOffset = (value: Animated.Value) =>
    value.interpolate({
      inputRange: MOVE_INPUT_RANGE,
      outputRange: [
        this.props.parallaxDegreeLowerBound,
        this.props.parallaxDegreeUpperBound,
      ],
    });

  handleExit = () => {
    Animated.spring(this.state.rotation.x, {
      toValue: this.props.initialX,
      friction: this.props.onExitSpringFriction,
      tension: this.props.onExitSpringTension,
    }).start();
    Animated.spring(this.state.rotation.y, {
      toValue: this.props.initialY,
      friction: this.props.onExitSpringFriction,
      tension: this.props.onExitSpringTension,
    }).start();
    this.toggleLatch();
  };

  handleEnter = () => {
    if (!this.props.moveOnLatchOnly) {
      setTimeout(() => this.setState(() => ({ latched: true })), 30);
    }
  };

  /**
   * The state of wobbly and prop getters are exposed as a parameter to the render prop.
   *
   * @typedef {object} StateAndHelpers
   *
   * @property {function} getMoveTargetProps - prop getter - returns the props to spread into the element which controls the parallax effect by moving over it.
   * @property {function} getWobblyTransformStyle - prop getter - returns the x,y state in a format the transform style property will take. Spread this into the style.transform array on an "Animated" element to which a parallax effect should be added. NOTE: This element must be "Animated" like "Animated.VrButton".
   * @property {number} x - state - x state value
   * @property {number} y - state - y state value
   * @property {number} latched - state - the latched state
   * @property {function} toggleLatch - action - function that toggles the latched date
   */
  getMoveTargetProps = (
    props: { onMove: () => void, onExit: () => void } = {
      onMove: () => {},
      onExit: () => {},
      onEnter: () => {},
    }
  ) => ({
    ...props,
    onMove: callAll(
      props.onMove,
      !this.state.latched
        ? noop
        : Animated.event([
            {
              nativeEvent: {
                offset: [this.state.rotation.y, this.state.rotation.x],
              },
            },
          ])
    ),
    onEnter: callAll(props.onEnter, this.handleEnter),
    onExit: callAll(props.onExit, this.handleExit),
    hitSlop: {
      top: this.props.slop,
      bottom: this.props.slop,
      left: this.props.slop,
      right: this.props.slop,
    },
  });
  getWobblyTransformStyle = () => [
    {
      rotateX: Animated.multiply(
        this.props.flipX ? negativeValue : positiveValue,
        this.interpolateMoveOffset(this.state.rotation.x)
      ),
    },
    {
      rotateY: Animated.multiply(
        this.props.flipY ? negativeValue : positiveValue,
        this.interpolateMoveOffset(this.state.rotation.y)
      ),
    },
  ];
  toggleLatch = () => this.setState(({ latched }) => ({ latched: !latched }));
  /**
   * Returns state and helpers for render callback.
   * @private
   *
   * @return {StateAndHelpers}
   *  The state and helper functions exposed as a parameter to the render callback
   */
  getStateAndHelpers(): StateAndHelpers {
    return {
      // Prop Getters
      getMoveTargetProps: this.getMoveTargetProps,
      getWobblyTransformStyle: this.getWobblyTransformStyle,
      // State
      x: this.state.rotation.x,
      y: this.state.rotation.y,
      latched: this.state.latched,
      // Action
      toggleLatch: this.toggleLatch,
    };
  }

  render() {
    const children = unwrapArray(
      this.props.render || this.props.children || noop
    );
    const element = unwrapArray(children(this.getStateAndHelpers()));
    if (!element) {
      return null;
    }
    return element;
  }
}

export default Wobbly;
