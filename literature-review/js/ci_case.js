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
  'litreview',
  {
    fields: ['*.*']
  }
).then(data => {
  self.indexData = data.data;
  console.log(this.indexData);
  self.newData =  self.indexData[0].text_body.replaceAll("applewebdata://AACC4B4A-BFE3-49A6-8DF0-420462282428","");
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


