////////////////////////////////////////
// reload page after Forward and back
///////////////////////////////////////

const TYPE_BACK_FORWARD = 2;

function isReloadedPage() {
  return performance.navigation.type === TYPE_BACK_FORWARD;
}

function main() {
  if (isReloadedPage()) {
    window.location.reload();
  }
}
main();

////////////////////////////////////////////////////////////
///// TEAM  API REQUEST ` `
////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////
///// PRE-RENDERED PAGES (see scripts/prerender.mjs)
////////////////////////////////////////////////////////////
// A pre-rendered page carries its Vue template and the CMS data inline:
// render from those instead of calling the API.
var PRERENDER = (function () {
  var tpl = document.getElementById('home-page-tpl');
  var json = document.getElementById('prerender-data');
  if (!tpl || !json) return null;
  try {
    return { template: '#home-page-tpl', data: JSON.parse(json.textContent).data };
  } catch (e) {
    return null;
  }
})();

Vue.use(VueMeta);

new Vue({
  el: '#home-page',
  template: PRERENDER ? PRERENDER.template : undefined,

  data () {
    return {
      indexData: [],
      newData: [],
      apiURL: 'https://burnes-center.directus.app',
    }
  },

  created: function created() {
    if (PRERENDER) this.setReview(PRERENDER.data.indexData);
    else this.fetchIndex();
  },
  methods: {
    setReview(items) {
      this.indexData = items;
      if (this.indexData && this.indexData.length > 0 && this.indexData[0].text_body) {
        this.newData = this.indexData[0].text_body.replaceAll("applewebdata://AACC4B4A-BFE3-49A6-8DF0-420462282428", "");
        this.newData = this.newData.replaceAll("</sup>", "</sup></a>");
      }
    },
    fetchIndex() {
      const self = this;
      fetch('https://burnes-center.directus.app/items/ci_litreview?fields%5B0%5D=%2A.%2A')
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then(data => {
          self.setReview(data.data);
          console.log(self.indexData);
          console.log(self.newData);
        })
        .catch(error => console.error(error));
    },
    hover(id){
      console.log(id);
      document.getElementById(id).classList.toggle("show");
    }
  }
});
