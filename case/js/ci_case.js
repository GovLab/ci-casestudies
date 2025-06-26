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
      apiURL: 'https://burnes-center.directus.app/ci_cases',

    }
  },

  created: function created() {
    this.memberslug=window.location.href.split('/');
    this.memberslug = this.memberslug[this.memberslug.length - 1];
    this.memberslug= this.memberslug.split('?')[0];
    this.memberslug= this.memberslug.split('#')[0];
    console.log(this.memberslug);
    this.memberslug = "vtaiwan";
    this.fetchIndex();
  },
  methods: {

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
          self.indexData = data.data;
          console.log(self.indexData);
          if (self.indexData && self.indexData.length > 0 && self.indexData[0].case_study_body) {
            self.newData = self.indexData[0].case_study_body.replaceAll("<sup>", "<sup><a href='#endnotes'>");
            self.newData = self.newData.replaceAll("</sup>", "</sup></a>");
            console.log(self.newData);
          }
        })
        .catch(error => console.error(error));
    },
    hover(id){
      console.log(id);
      document.getElementById(id).classList.toggle("show");
      
      
    }
}
});


