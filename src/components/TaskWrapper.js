import React from 'react';

import {
  TouchableNativeFeedback,
  Animated
} from 'react-native';

class TaskWrapper extends React.Component {
  render() {
    let style = [this.props.style];
    const { item, hidden } = this.props;

    if (hidden) {
      style.push({ opacity: 0 });
    }

    return (
      <TouchableNativeFeedback
        onPressIn={this.props.onPressIn}
        onPress={this.props.onPress}
      >
        <Animated.View style={style}>
          {this.props.children}
        </Animated.View>
      </TouchableNativeFeedback>
    )
  }
};

export default TaskWrapper;
