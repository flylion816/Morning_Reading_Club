const COVERS = {
  dawn: '/assets/images/daily-card-cover-dawn.png',
  paper: '/assets/images/daily-card-cover-paper.png',
  blank: '/assets/images/daily-card-cover-blank.png'
};

function getDailyCardShareCover(variant) {
  return COVERS[variant] || COVERS.dawn;
}

module.exports = { getDailyCardShareCover };
