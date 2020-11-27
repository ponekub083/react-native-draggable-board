import React from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import ReactTimeout from 'react-timeout';
import Column from './Column';
import TaskWrapper from './TaskWrapper';
import {AutoDragSortableView,DragSortableView} from 'react-native-drag-sort'
import { withAnchorPoint } from 'react-native-anchor-point';

const { width : winWidth, height : winHeigth } = Dimensions.get('window');
class Board extends React.Component {
  MAX_RANGE = 100;
  MAX_DEG = 25;
  MAX_SCALE = 1;
  TRESHOLD = 56;

  constructor(props) {
    super(props);

    this.verticalOffset = 0;
    this.verticalOffsetScrolling = 0;
    this.hasBeenScroll = false;
    this.zoomRef;
    this.scrollResponderRef;

    this.state = {
      rotate: new Animated.Value(0),
      scaleValue : new Animated.Value(1),
      startingX: 0,
      startingY: 0,
      x: 0,
      y: 0,
      movingMode: false,
      dragColumn : false,
      firstClick: 0,
    };

    this.panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => this.state.movingMode,
      onMoveShouldSetPanResponder: () => this.state.movingMode,
      onPanResponderTerminationRequest: () => !this.state.movingMode,
      onPanResponderMove: this.onPanResponderMove.bind(this),
      onPanResponderRelease: this.onPanResponderRelease.bind(this),
      onPanResponderTerminate: this.onPanResponderRelease.bind(this),
    });
  }

  componentWillUnmount() {
    this.unsubscribeFromMovingMode();
    this.verticalOffset = 0;
  }

  onPanResponderMove(event, gesture, callback) {
    const leftTopCornerX = this.state.startingX + gesture.dx;
    const leftTopCornerY = this.state.startingY + gesture.dy;
    if (this.state.movingMode && !this.state.dragColumn ) {
      const draggedItem = this.state.draggedItem;
      this.x = event.nativeEvent.pageX;
      this.y = event.nativeEvent.pageY;
      const columnAtPosition = this.props.rowRepository.move(
        draggedItem,
        this.x,
        this.y,
      );
      if (columnAtPosition) {
        let { scrolling, offset } = this.props.rowRepository.scrollingPosition(
          columnAtPosition,
          this.x   + this.verticalOffset,
          this.y,
        );
        if (this.shouldScroll(scrolling, offset, columnAtPosition)) {
          this.scroll(columnAtPosition, draggedItem, offset);
        }
      }

      this.setState({
        x: leftTopCornerX,
        y: leftTopCornerY,
      });
      // tu:du:
     this.calculateScroll(gesture);
    }
  }

  calculateScroll(gesture){
      const padding = this.props.columnWidth + 32;
      if (
        gesture.moveX > gesture.x0 &&
        gesture.moveX + 75 > winWidth
         && !this.hasBeenScroll
      ) {
        
        this.containerScrollView.scrollTo({
          x:
            this.verticalOffset + padding,
            animated: true 
        });

        this.hasBeenScroll = true;
      }

      if (
        gesture.moveX < gesture.x0 &&
        gesture.moveX < 75 
        && !this.hasBeenScroll 
      ) {
        this.containerScrollView.scrollTo({
          x:
            this.verticalOffset - padding,
             animated: true 
        });
        this.hasBeenScroll = true;
      }
      if(this.hasBeenScroll)
        this.props.setTimeout(()=>{  this.hasBeenScroll = false }, 2000);
  }

  shouldScroll(scrolling, offset, column) {
    const placeToScroll =
      (offset < 0 && column.scrollOffset() > 0) ||
      (offset > 0 && column.scrollOffset() < column.contentHeight());

    return scrolling && offset != 0 && placeToScroll;
  }

  onScrollingStarted() {
    this.scrolling = true;
  }

  onScrollingEnded() {
    this.scrolling = false;
  }

  isScrolling() {
    return this.scrolling;
  }

  scroll(column, draggedItem, anOffset) {
    try {
     if (!this.isScrolling()) {
        this.onScrollingStarted();
        const scrollOffset = column.scrollOffset() + 70 * anOffset;
        this.props.rowRepository.setScrollOffset(column.id(), scrollOffset);

        column.listView().scrollToOffset({ offset : scrollOffset , animated : true});
     }
      this.props.rowRepository.move(draggedItem, this.x, this.y);
      let { scrolling, offset } = this.props.rowRepository.scrollingPosition(
        column,
        this.x,
        this.y,
      );
      if (this.shouldScroll(scrolling, offset, column)) {
        this.props.requestAnimationFrame(() => {
          this.scroll(column, draggedItem, offset);
        });
      }
    } catch (e) {}
  }

  endMoving() {
    this.setState({ movingMode: false });
    const { srcColumnId, draggedItem } = this.state;
    const { rowRepository, onDragEnd } = this.props;
    rowRepository.show(draggedItem.columnId(), draggedItem);
    rowRepository.notify(draggedItem.columnId(), 'reload');

    const destColumnId = draggedItem.columnId();
    onDragEnd && onDragEnd(srcColumnId, destColumnId, draggedItem);
    // tu:du:
    if (this.verticalOffset !== this.verticalOffsetScrolling) {
      this.verticalOffset = this.verticalOffsetScrolling;
      this.props.rowRepository.updateColumnsLayoutAfterVisibilityChanged();
    }
    this.hasBeenScroll = false;
  }

  
  onPanResponderRelease(e, gesture) {
    this.x = null;
    this.y = null;
    if (this.state.movingMode) {
      this.rotateBack();
      this.props.setTimeout(this.endMoving.bind(this), 200);
    } else if (this.isScrolling()) {
      this.unsubscribeFromMovingMode();
    }
  }

  rotateTo(value) {
    Animated.spring(this.state.rotate, {
      toValue: value,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }

  rotate() {
    this.rotateTo(this.MAX_DEG);
  }

  rotateBack() {
    this.rotateTo(0);
  }

  open(row) {
    this.props.open(row);
  }

  cancelMovingSubscription() {
    this.props.clearTimeout(this.movingSubscription);
  }

  unsubscribeFromMovingMode() {
    this.cancelMovingSubscription();
  }

  onPressIn(columnId, item, columnCallback) {
    if (item.isLocked()) {
      return;
    }
    return () => {
      if (!item || (item.isLocked() && this.isScrolling()) || this.state.dragColumn) {
        this.unsubscribeFromMovingMode();
        return;
      }
      this.movingSubscription = this.props.setTimeout(() => {
        if (!item || !item.layout() ) {
          return;
        }
        const { x, y } = item.layout();
        this.props.rowRepository.hide(columnId, item);
        this.setState({
          movingMode: true,
          draggedItem: item,
          srcColumnId: item.columnId(),
          startingX: x,
          startingY: y,
          x: x,
          y: y,
        });
        columnCallback();
        this.rotate();
      }, this.longPressDuration());
    };
  }

  longPressDuration() {
    return Platform.OS === 'ios' ? 200 : 200;
  }

  onPress(item) {
    if (item.isLocked()) {
      return;
    }

    return () => {
      this.unsubscribeFromMovingMode();

      if (item.isLocked() || this.state.dragColumn) {
        return;
      }

      if (!this.state.movingMode) {
        this.open(item.row());
      } else {
        this.endMoving();
      }
    };
  }

  onScroll(event) {
    // tu:du:
    this.verticalOffsetScrolling = event.nativeEvent.contentOffset.x;
    if (this.verticalOffset !== this.verticalOffsetScrolling) {
      this.verticalOffset = this.verticalOffsetScrolling;
      this.props.rowRepository.updateColumnsLayoutAfterVisibilityChanged();
    }
    this.cancelMovingSubscription();
  }

  onScrollEnd(event) {
    this.props.rowRepository.updateColumnsLayoutAfterVisibilityChanged();
    this.verticalOffset = event.nativeEvent.contentOffset.x;
  }

  movingStyle(zIndex) {
    var interpolatedRotateAnimation = this.state.rotate.interpolate({
      inputRange: [-this.MAX_RANGE, 0, this.MAX_RANGE],
      outputRange: [`-${this.MAX_DEG}deg`, '0deg', `${this.MAX_DEG}deg`],
    });
    return {
      transform: [{ rotate: interpolatedRotateAnimation }],
      position: 'absolute',
      zIndex: zIndex,
      elevation: zIndex,
      top: this.state.y - this.TRESHOLD ,
      left: this.verticalOffset + this.state.x,
      width: this.props.columnWidth - 32,
    };
  }

  movingTask() {
    const { draggedItem, movingMode } = this.state;
    const zIndex = movingMode ? 1 : -1;
    const data = {
      item: draggedItem,
      hidden: !movingMode,
      style: this.movingStyle(zIndex),
    };
    return this.renderWrapperRow(data);
  }

  renderWrapperRow(data) {
    const { renderRow } = this.props;
    return (
      <TaskWrapper {...data}>
        {renderRow && data.item && renderRow(data.item.row())}
      </TaskWrapper>
    );
  }

  handleDragColumn (value) {
    //
      Animated.timing( this.state.scaleValue, {
            toValue: value,
            duration: 2000,
            useNativeDriver: false,
        }).start()
  };

  onDragStart (startIndex,endIndex){
    this.setState({
    movingMode: true,
     })
     this.handleDragColumn(this.props.minScale);
  }
  onDragEnd(startIndex){
    this.setState({
                movingMode: false,
                dragColumn : false,
                })
    this.handleDragColumn(1);
      if (this.verticalOffset !== this.verticalOffsetScrolling) {
      this.verticalOffset = this.verticalOffsetScrolling;
      this.props.rowRepository.updateColumnsLayoutAfterVisibilityChanged();
    }
    this.hasBeenScroll = false;
   }

   onDataChange (data){
     //
  }

  onDragging (gestureState, left, top, moveToIndex) {
    //
    
    this.calculateScroll(gestureState);
  }


  render() {
    const columns = this.props.rowRepository.columns();
    // const columnWrappers = columns.map((column) => {
     
    // });

    const {minScale} = this.props;
    const inputRange = [minScale, 1];
    const outputRange = [minScale, 1];

    const SPACING_FOR_CARD_INSET =  this.props.columnWidth * 0.1 - 10;

    const parentWidth =  (this.props.columnWidth+ 32) * columns.length
    const childrenWidth = this.props.columnWidth +32
    const childrenHeight = winHeigth;

     let transform = {
        transform: [{ scale: this.state.scaleValue }],
    };
    const transforObj = withAnchorPoint(transform, { x: (this.state.firstClick + this.verticalOffset) /parentWidth , y: 56 / winHeigth }, { width: parentWidth, height: childrenHeight });
    
    return (
      <View style={{flex : 1 }}>
      <ScrollView
        pagingEnabled
        decelerationRate={0}
        snapToInterval={this.props.columnWidth}
        snapToAlignment="center"
        overScrollMode={'auto'}
        contentInset={{
          // iOS ONLY
          top: 0,
          left: SPACING_FOR_CARD_INSET, // Left spacing for the very first card
          bottom: 0,
          right: SPACING_FOR_CARD_INSET, // Right spacing for the very last card
        }}
        contentContainerStyle={{
          // contentInset alternative for Android
          paddingHorizontal: Platform.OS === 'android' ? 10 : 0, // Horizontal spacing before and after the ScrollView
        }}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        ref={(ref) => (this.containerScrollView = ref)}
        scrollEventThrottle={16}
        style={{...this.props.style}}
        contentContainerStyle={this.props.contentContainerStyle}
        scrollEnabled={!this.state.movingMode}
        onScroll={this.onScroll.bind(this)}
        onScrollEndDrag={this.onScrollEnd.bind(this)}
        onMomentumScrollEnd={this.onScrollEnd.bind(this)}
        horizontal={true}
        {...this.panResponder.panHandlers}
      >
        {this.movingTask()}
        <Animated.View style={[{flex: 1}]}>
        <DragSortableView 
          isDragFreely
          dataSource={columns}
          parentWidth={parentWidth}
          childrenHeight={childrenHeight}
          childrenWidth= {childrenWidth}
          updateOffset ={()=> this.verticalOffset}
          firstClick={(positionX) => this.setState({firstClick : positionX})}
          maxScale={1.015}
          delayLongPress={10}
          scrollEventThrottle={16}
          onClickItem={(originData , itemData , index)=>{
               this.setState({
                            dragColumn : true,
                        })
          }}
          onDragStart={this.onDragStart.bind(this)}
          onDragEnd={this.onDragEnd.bind(this)}
          onDataChange={this.onDataChange.bind(this)}
          onDragging={this.onDragging.bind(this)}
          keyExtractor={(item,index)=>item.id} 
          renderItem={(column,index)=>{
            const columnComponent = (
              <Column
                maxScale={0.5}
                column={column}
                movingMode={this.state.movingMode}
                rowRepository={this.props.rowRepository}
                onPressIn={this.onPressIn.bind(this)}
                onPress={this.onPress.bind(this)}
                onPanResponderMove={this.onPanResponderMove.bind(this)}
                onPanResponderRelease={this.onPanResponderRelease.bind(this)}
                renderWrapperRow={this.renderWrapperRow.bind(this)}
                onScrollingStarted={this.onScrollingStarted.bind(this)}
                onScrollingEnded={this.onScrollingEnded.bind(this)}
                unsubscribeFromMovingMode={this.cancelMovingSubscription.bind(this)}
              />
            );
            return this.props.renderColumnWrapper(
              column.data(),
              column.index(),
              columnComponent,
            );
          }}
        />
        </Animated.View>
      </ScrollView>
      </View>
    );
  }
}

export default ReactTimeout(Board);
