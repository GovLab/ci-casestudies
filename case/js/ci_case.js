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
      apiURL: 'https://directus.thegovlab.com/ci_cases',

    }
  },

  created: function created() {
    this.memberslug=window.location.href.split('/');
    this.memberslug = this.memberslug[this.memberslug.length - 1];
    this.memberslug= this.memberslug.split('?')[0];
    this.memberslug= this.memberslug.split('#')[0];
    console.log(this.memberslug);
    this.fetchIndex();
  },
  methods: {

    fetchIndex() {
      self = this;
      const client = new DirectusSDK({
        url: "https://directus.thegovlab.com/",
        project: "ci_cases",
        storage: window.localStorage
      });

      client.getItems(
  'case_studies',
  {
    filter: {
      slug: self.memberslug
    },
    fields: ['*.*']
  }
).then(data => {
  self.indexData = data.data;
  console.log(this.indexData);
  self.newData =  self.indexData[0].case_study_body.replaceAll("<sup>","<sup><a href='#endnotes'>");
  self.newData =  self.newData.replaceAll("</sup>","</sup></a>");
  console.log(newData);
})
.catch(error => console.error(error));
    },
    hover(id){
      console.log(id);
      document.getElementById(id).classList.toggle("show");
      
      
    }
}
});


