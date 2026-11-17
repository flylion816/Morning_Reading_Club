// 日签的分享封面。日签和 landing 两个分包都要用，分包之间不能互相引用，
// 所以 pages/daily-card 和 pages/landing 下各放一份同样的，测试守着两份一致，改的时候两份一起改。
const COVERS = {
  dawn: '/assets/images/daily-card-cover-dawn.png',
  paper: '/assets/images/daily-card-cover-paper.png',
  blank: '/assets/images/daily-card-cover-blank.png'
};

function getDailyCardShareCover(variant) {
  return COVERS[variant] || COVERS.dawn;
}

module.exports = { getDailyCardShareCover };
