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
    
  el: '#project-page',
    
  data () {
 
    return {
      filterData: [],
      reportData: [],
      apiURL: 'https://directus.thegovlab.com/data4covid',
    }
  },

  created: function created() {

    this.memberslug=window.location.search.split('?')[1];
    console.log(this.memberslug);
    this.fetchIndex();
    this.fetchReport();
  },
  methods: {

    fetchIndex() {
     
      self = this;
      const client = new DirectusSDK({
        url: "https://directus.thegovlab.com/",
        project: "data4covid",
        storage: window.localStorage
      });

      client.getItems(
  'projects',
  {
    filter: {
      slug: self.memberslug
    },
    fields: ['*.*']
  }
).then(data => {
  
  self.indexData = data.data;
  self.filterData = self.indexData;
})
.catch(error => console.error(error));
    },
    fetchReport() {
     
      self = this;
      const client = new DirectusSDK({
        url: "https://directus.thegovlab.com/",
        project: "data4covid",
        storage: window.localStorage
      });

      client.getItems(
  'report_page',
  {
    fields: ['*.*']
  }
).then(data => {
  
  self.reportData = data.data;
})
.catch(error => console.error(error));
    },
    dateShow(date) {
      return moment(date).format("MMMM YYYY");
    },
}});


