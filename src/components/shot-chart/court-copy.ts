export const courtCopy = {
  en: {
    noAttempts: "No attempts", compareTeams: "Two teams. One court.", fullCourt: "Full court", halfCourt: "Half court", backFull: "← Full court", focusView: "Court focus", away: "AWAY · LEFT", home: "HOME · RIGHT", shown: "Shown", fgScope: "FG includes all results for selected players / period",
    comparisonLegend: "Filled circles: made. Hollow circles: missed. Team colors identify each side.", standardized: "Standardized comparison: away on the left, home on the right. Source coordinates are basket-relative, not actual attacking direction. Markers show recorded shot locations, not ball flight.", keyboardHelp: "Use arrow keys to browse shots, Home / End to jump, Escape to clear.", focusHint: "Choose a half court to enlarge", halfHint: "Focused view · selections are kept",

    recordedPositions: "RECORDED SHOT LOCATIONS", flatHelp: "Hover or tap a shot to explore",
    filters: "Filters", hideFilters: "Close filters", choosePlayer: "Choose a player", shotsLabel: "shots", sameSpot: "Shots at this spot", nextAtSpot: "Next at this spot",
    three: "3D court", top: "Top down", reset: "Reset view", rotateLeft: "Rotate left", rotateRight: "Rotate right", zoomIn: "Zoom in", zoomOut: "Zoom out",
    team: "Team", player: "Player", period: "Period", outcome: "Result", allTeams: "Both teams", allPlayers: "All players", allPeriods: "Whole game", allResults: "All shots", made: "Made", missed: "Missed", attempts: "attempts", fg: "FG", threes: "3PT", clear: "Clear filters",
    help: "Drag sideways to rotate · Tap a shot for details", noShots: "No shots match these filters.", select: "Select a shot on the court or in the list.", selected: "Selected shot", list: "Shot list", showList: "Browse every shot", close: "Clear selection", previous: "Previous shot", next: "Next shot",
    loading: "Loading the 3D court…", fallback: "3D is unavailable on this device. The top-down court and all shot details remain available.", retry: "Try 3D again", coverage: "verified shot locations", source: "NBA official game charts", normalized: "Both teams shown toward one basket. Markers show recorded shot locations, not ball flight.", coordinates: "Basket-relative location", feet: "ft", view: "Interactive basketball shot locations", behind: "behind the basket", towards: "toward midcourt", left: "left", right: "right", center: "center", legend: "Solid circles: made. Crosses: missed.", quarter: "Q", overtime: "OT", madeOf: "made", position: "Location", summary: "Filtered shooting", listHint: "The list includes every filtered shot and is keyboard accessible.",
  },
  zh: {
    noAttempts: "暂无出手", compareTeams: "两队出手，一场看清", fullCourt: "全场对比", halfCourt: "半场", backFull: "← 返回全场", focusView: "球场聚焦", away: "客队 · 左侧", home: "主队 · 右侧", shown: "显示", fgScope: "命中率按所选球员 / 节次的全部出手计算",
    comparisonLegend: "实心圆表示命中，空心圆表示未中，队色区分双方。", standardized: "标准化对比：客队在左、主队在右。原始坐标相对篮筐，不代表比赛实际进攻方向。标记为记录的出手位置，不代表篮球飞行轨迹。", keyboardHelp: "方向键逐次查看，Home / End 跳至首尾，Escape 取消选择。", focusHint: "切换半场，放大查看", halfHint: "半场聚焦 · 保留双方筛选",

    recordedPositions: "真实出手位置", flatHelp: "悬停或点选投篮，查看球员与比赛时刻",
    filters: "筛选", hideFilters: "收起筛选", choosePlayer: "选择球员", shotsLabel: "次投篮", sameSpot: "同一位置的投篮", nextAtSpot: "查看该位置下一次投篮",
    three: "3D 球场", top: "俯视", reset: "重置视角", rotateLeft: "向左旋转", rotateRight: "向右旋转", zoomIn: "放大", zoomOut: "缩小",
    team: "球队", player: "球员", period: "节次", outcome: "结果", allTeams: "两队", allPlayers: "全部球员", allPeriods: "全场", allResults: "全部投篮", made: "命中", missed: "未中", attempts: "次出手", fg: "命中率", threes: "三分", clear: "清除筛选",
    help: "左右拖动旋转 · 点选投篮查看详情", noShots: "该筛选条件下没有投篮记录。", select: "点选球场上的投篮，或从列表查看。", selected: "投篮详情", list: "投篮列表", showList: "查看逐次投篮", close: "取消选择", previous: "上一次投篮", next: "下一次投篮",
    loading: "正在加载 3D 球场…", fallback: "当前设备无法显示 3D，仍可使用俯视球场和完整投篮列表。", retry: "重试 3D", coverage: "个已核实投篮位置", source: "NBA 官方比赛投篮图", normalized: "两队统一朝向同一篮筐。标记为记录的出手位置，不代表篮球飞行轨迹。", coordinates: "相对篮筐位置", feet: "英尺", view: "交互式篮球投篮位置图", behind: "篮筐后方", towards: "朝中场", left: "左侧", right: "右侧", center: "中线", legend: "实心圆表示命中，叉号表示未中。", quarter: "第", overtime: "加时", madeOf: "命中", position: "位置", summary: "筛选后的投篮统计", listHint: "列表包含全部筛选后的投篮，支持键盘操作。",
  },
} as const;
export type CourtCopy = typeof courtCopy.en | typeof courtCopy.zh;
