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
      apiURL: 'https://burnes-center.directus.app/ci_cases',

    }
  },

  created: function created() {
    // Slug = last path segment, without query, hash, trailing slash or ".html".
    var parts = window.location.pathname.split('/').filter(Boolean);
    this.memberslug = decodeURIComponent((parts.pop() || '').replace(/\.html$/, ''));
    console.log(this.memberslug);
    // this.memberslug = "vtaiwan";
    if (PRERENDER) this.setCase(PRERENDER.data.indexData);
    else this.fetchIndex();
  },
  methods: {

    setCase(items) {
      this.indexData = items;
      if (this.indexData && this.indexData.length > 0 && this.indexData[0].case_study_body) {
        this.newData = this.indexData[0].case_study_body.replaceAll("<sup>", "<sup><a href='#endnotes'>");
        this.newData = this.newData.replaceAll("</sup>", "</sup></a>");
      }
    },
    fetchIndex() {
      const self = this;
      // Build the URL dynamically based on the current slug
      const url = `https://burnes-center.directus.app/items/ci_case_studies?filter[slug]=${encodeURIComponent(self.memberslug)}&fields[0]=*.*`;
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then(data => {
          self.setCase(data.data);
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


