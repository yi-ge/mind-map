import Base from './Base'
import { walk, asyncRun, getNodeIndexInNodeList } from '../utils'

//  逻辑结构图
class LogicalStructure extends Base {
  //  构造函数
  constructor(opt = {}) {
    super(opt)
  }

  //  布局
  doLayout(callback) {
    let task = [
      () => {
        this.computedBaseValue()
      },
      () => {
        this.computedTopValue()
      },
      () => {
        this.adjustTopValue()
      },
      () => {
        callback(this.root)
      }
    ]
    asyncRun(task)
  }

  //  遍历数据计算节点的left、width、height
  computedBaseValue() {
    walk(
      this.renderer.renderTree,
      null,
      (cur, parent, isRoot, layerIndex) => {
        let newNode = this.createNode(cur, parent, isRoot, layerIndex)
        // 根节点定位在画布中心位置
        if (isRoot) {
          this.setNodeCenter(newNode)
        } else {
          // 非根节点
          // 定位到父节点右侧
          newNode.left =
            parent._node.left + parent._node.width + this.getMarginX(layerIndex)
        }
        if (!cur.data.expand) {
          return true
        }
      },
      (cur, parent, isRoot, layerIndex) => {
        // 返回时计算节点的areaHeight，也就是子节点所占的高度之和，包括外边距
        let len = cur.data.expand === false ? 0 : cur._node.children.length
        cur._node.childrenAreaHeight = len
          ? cur._node.children.reduce((h, item) => {
              return h + item.height
            }, 0) +
            (len + 1) * this.getMarginY(layerIndex + 1)
          : 0
        // 如果存在概要，则和概要的高度取最大值
        let generalizationNodeHeight = cur._node.checkHasGeneralization()
          ? cur._node._generalizationNodeHeight +
            this.getMarginY(layerIndex + 1)
          : 0
        cur._node.childrenAreaHeight2 = Math.max(
          cur._node.childrenAreaHeight,
          generalizationNodeHeight
        )
      },
      true,
      0
    )
  }

  //  遍历节点树计算节点的top
  computedTopValue() {
    walk(
      this.root,
      null,
      (node, parent, isRoot, layerIndex) => {
        if (node.getData('expand') && node.children && node.children.length) {
          let marginY = this.getMarginY(layerIndex + 1)
          // 第一个子节点的top值 = 该节点中心的top值 - 子节点的高度之和的一半
          let top = node.top + node.height / 2 - node.childrenAreaHeight / 2
          let totalTop = top + marginY
          node.children.forEach(cur => {
            cur.top = totalTop
            totalTop += cur.height + marginY
          })
        }
      },
      null,
      true
    )
  }

  //  调整节点top
  adjustTopValue() {
    walk(
      this.root,
      null,
      (node, parent, isRoot, layerIndex) => {
        if (!node.getData('expand')) {
          return
        }
        // 判断子节点所占的高度之和是否大于该节点自身，大于则需要调整位置
        let difference =
          node.childrenAreaHeight2 -
          this.getMarginY(layerIndex + 1) * 2 -
          node.height
        if (difference > 0) {
          this.updateBrothers(node, difference / 2)
        }
      },
      null,
      true
    )
  }

  //  更新兄弟节点的top
  updateBrothers(node, addHeight) {
    if (node.parent) {
      let childrenList = node.parent.children
      let index = getNodeIndexInNodeList(node, childrenList)
      childrenList.forEach((item, _index) => {
        if (item.uid === node.uid || item.hasCustomPosition()) {
          // 适配自定义位置
          return
        }
        let _offset = 0
        // 上面的节点往上移
        if (_index < index) {
          _offset = -addHeight
        } else if (_index > index) {
          // 下面的节点往下移
          _offset = addHeight
        }
        item.top += _offset
        // 同步更新子节点的位置
        if (item.children && item.children.length) {
          this.updateChildren(item.children, 'top', _offset)
        }
      })
      // 更新父节点的位置
      this.updateBrothers(node.parent, addHeight)
    }
  }

  //  绘制连线，连接该节点到其子节点
  renderLine(node, lines, style, lineStyle) {
    if (lineStyle === 'curve') {
      this.renderLineCurve(node, lines, style)
    } else if (lineStyle === 'direct') {
      this.renderLineDirect(node, lines, style)
    } else {
      this.renderLineStraight(node, lines, style)
    }
  }

  //  直线风格连线
  renderLineStraight(node, lines, style) {
    if (node.children.length <= 0) {
      return []
    }
    let { left, top, width, height, expandBtnSize } = node
    if (!this.mindMap.opt.alwaysShowExpandBtn) {
      expandBtnSize = 0
    }
    let marginX = this.getMarginX(node.layerIndex + 1)
    let s1 = (marginX - expandBtnSize) * 0.6
    let nodeUseLineStyle = this.mindMap.themeConfig.nodeUseLineStyle
    node.children.forEach((item, index) => {
      let x1 =
        node.layerIndex === 0 ? left + width : left + width + expandBtnSize
      let y1 = top + height / 2
      let x2 = item.left
      let y2 = item.top + item.height / 2
      // 节点使用横线风格，需要额外渲染横线
      let nodeUseLineStyleOffset = nodeUseLineStyle ? item.width : 0
      y1 = nodeUseLineStyle && !node.isRoot ? y1 + height / 2 : y1
      y2 = nodeUseLineStyle ? y2 + item.height / 2 : y2
      let path = `M ${x1},${y1} L ${x1 + s1},${y1} L ${x1 + s1},${y2} L ${
        x2 + nodeUseLineStyleOffset
      },${y2}`
      this.setLineStyle(style, lines[index], path, item)
    })
  }

  //  直连风格
  renderLineDirect(node, lines, style) {
    if (node.children.length <= 0) {
      return []
    }
    let { left, top, width, height, expandBtnSize } = node
    if (!this.mindMap.opt.alwaysShowExpandBtn) {
      expandBtnSize = 0
    }
    let nodeUseLineStyle = this.mindMap.themeConfig.nodeUseLineStyle
    node.children.forEach((item, index) => {
      let x1 =
        node.layerIndex === 0 ? left + width / 2 : left + width + expandBtnSize
      let y1 = top + height / 2
      let x2 = item.left
      let y2 = item.top + item.height / 2
      y1 = nodeUseLineStyle && !node.isRoot ? y1 + height / 2 : y1
      y2 = nodeUseLineStyle ? y2 + item.height / 2 : y2
      // 节点使用横线风格，需要额外渲染横线
      let nodeUseLineStylePath = nodeUseLineStyle
        ? ` L ${item.left + item.width},${y2}`
        : ''
      let path = `M ${x1},${y1} L ${x2},${y2}` + nodeUseLineStylePath
      this.setLineStyle(style, lines[index], path, item)
    })
  }

  //  曲线风格连线
  renderLineCurve(node, lines, style) {
    if (node.children.length <= 0) {
      return []
    }
    let { left, top, width, height, expandBtnSize } = node
    if (!this.mindMap.opt.alwaysShowExpandBtn) {
      expandBtnSize = 0
    }
    let nodeUseLineStyle = this.mindMap.themeConfig.nodeUseLineStyle
    node.children.forEach((item, index) => {
      let x1 =
        node.layerIndex === 0 ? left + width / 2 : left + width + expandBtnSize
      let y1 = top + height / 2
      let x2 = item.left
      let y2 = item.top + item.height / 2
      let path = ''
      y1 = nodeUseLineStyle && !node.isRoot ? y1 + height / 2 : y1
      y2 = nodeUseLineStyle ? y2 + item.height / 2 : y2
      // 节点使用横线风格，需要额外渲染横线
      let nodeUseLineStylePath = nodeUseLineStyle
        ? ` L ${item.left + item.width},${y2}`
        : ''
      if (node.isRoot && !this.mindMap.themeConfig.rootLineKeepSameInCurve) {
        path = this.quadraticCurvePath(x1, y1, x2, y2) + nodeUseLineStylePath
      } else {
        path = this.cubicBezierPath(x1, y1, x2, y2) + nodeUseLineStylePath
      }
      this.setLineStyle(style, lines[index], path, item)
    })
  }

  //  渲染按钮
  renderExpandBtn(node, btn) {
    let { width, height } = node
    let { translateX, translateY } = btn.transform()
    // 节点使用横线风格，需要调整展开收起按钮位置
    let nodeUseLineStyleOffset = this.mindMap.themeConfig.nodeUseLineStyle
      ? height / 2
      : 0
    // 位置没有变化则返回
    let _x = width
    let _y = height / 2 + nodeUseLineStyleOffset
    if (_x === translateX && _y === translateY) {
      return
    }
    btn.translate(_x - translateX, _y - translateY)
  }

  //  创建概要节点
  renderGeneralization(list) {
    list.forEach(item => {
      let {
        top,
        bottom,
        right,
        generalizationLineMargin,
        generalizationNodeMargin
      } = this.getNodeGeneralizationRenderBoundaries(item, 'h')
      let x1 = right + generalizationLineMargin
      let y1 = top
      let x2 = right + generalizationLineMargin
      let y2 = bottom
      let cx = x1 + 20
      let cy = y1 + (y2 - y1) / 2
      let path = `M ${x1},${y1} Q ${cx},${cy} ${x2},${y2}`
      item.generalizationLine.plot(path)
      item.generalizationNode.left = right + generalizationNodeMargin
      item.generalizationNode.top =
        top + (bottom - top - item.generalizationNode.height) / 2
    })
  }

  // 渲染展开收起按钮的隐藏占位元素
  renderExpandBtnRect(rect, expandBtnSize, width, height, node) {
    rect.size(expandBtnSize, height).x(width).y(0)
  }
}

export default LogicalStructure
