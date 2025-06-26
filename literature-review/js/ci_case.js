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

Vue.use(VueMeta);

new Vue({
  el: '#home-page',

  data () {
    return {
      indexData: [],
      newData: [],
      apiURL: 'https://burnes-center.directus.app',
    }
  },

  created: function created() {
    this.fetchIndex();
  },
  methods: {
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
          self.indexData = data.data;
          if (self.indexData && self.indexData.length > 0 && self.indexData[0].text_body) {
            self.newData = self.indexData[0].text_body.replaceAll("applewebdata://AACC4B4A-BFE3-49A6-8DF0-420462282428", "");
            self.newData = self.newData.replaceAll("</sup>", "</sup></a>");
          }
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
