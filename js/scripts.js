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

  data() {

    return {
      indexData: [],
      filterData: [],
      // js_scope: [
      //   { code: '', name: 'All' },
      //   { code: '0', name: 'Local' },
      //   { code: '1', name: 'Regional' },
      //   { code: '2', name: 'National' },
      //   { code: '3', name: 'Multilateral' },
      //   { code: '4', name: 'Undefined' },
      // ],
      // js_phase: [
      //   { code: '', name: 'All' },
      //   { code: 'phase_0', name: 'Readiness' },
      //   { code: 'phase_1', name: 'Response' },
      //   { code: 'phase_2', name: 'Recovery' },
      //   { code: 'phase_3', name: 'Reform' },
      // ],
      // js_regions: [
      //   { code: '', name: 'All' },
      //   { code: 'eap', name: 'East Asia and Pacific' },
      //   { code: 'eca', name: 'Europe and Central Asia' },
      //   { code: 'lac', name: 'Latin America and the Caribbean' },
      //   { code: 'mena', name: 'Middle East and North Africa' },
      //   { code: 'na', name: 'North America' },
      //   { code: 'ssa', name: 'Sub-Saharan Africa' },
      //   { code: 'sasia', name: 'South Asia' },
      //   { code: 'global', name: 'Global' },
      // ],
      // js_topic: [
      //   { code: '', name: 'All' },
      //   { code: 'topic_0', name: 'Tracking the Pandemic’s Evolution' },
      //   { code: 'topic_1', name: 'Developing Disease Treatment' },
      //   { code: 'topic_2', name: 'Identifying Availability and Demand for Supplies' },
      //   { code: 'topic_3', name: 'Monitoring Adherence to Health Protocols and Practices' },
      //   { code: 'topic_4', name: 'Understanding Public Perceptions, Well-being and Behavior' },
      //   { code: 'topic_5', name: 'Protecting Democracy, Human Rights and Promoting Government Accountability' },
      //   { code: 'topic_6', name: 'Addressing Misinformation' },
      //   { code: 'topic_7', name: 'Supporting Post-Pandemic Re-openings and Recovery' },
      //   { code: 'topic_8', name: 'Alleviating the Burden on Migrants' },
      //   { code: 'topic_9', name: 'Alleviating Pandemic-related Unemployment and Poverty' },
      //   { code: 'topic_10', name: 'Guaranteeing Protections for Workers' },
      //   { code: 'topic_11', name: 'Supporting Education and Upskilling' },
      //   { code: 'topic_12', name: 'Fostering Business and Government Solvency' },
      //   { code: 'topic_13', name: 'Assessing Environmental Impact' },
      //   { code: 'topic_14', name: 'Understanding the Economic Impact' },

      // ],
      selectedProjectType: null,
      apiURL: 'https://directus.thegovlab.com/ci_cases',
    }
  },

  created: function created() {
    this.memberslug = window.location.pathname.split('/');
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
          fields: ['*.*']
        }
      ).then(data => {

        self.indexData = data.data;
        self.filterData = self.indexData;
      })
        .catch(error => console.error(error));
    },
    dateShow(date) {
      return moment(date).format("MMMM YYYY");
    }
    // searchItems() {

    //   squery = document.getElementById('search-text').value;
    //   let searchData = self.indexData.filter(items => items.title.toLowerCase().includes(squery.toLowerCase()));
    //   self.filterData = searchData;
    // },
    // ResetItems() {
    //   self.filterData = self.indexData;
    // },
    // changeFilter(event) {
    //   var element = document.body.querySelectorAll("select");
    //   this.selectedScope = element[0].value;
    //   this.selectedRegion = element[1].value;
    //   this.selectedArea = element[2].value;
    //   this.selectedPhase = element[3].value;
    //   console.log(this.selectedPhase);
    //   //Scope Filter
    //   if (this.selectedScope == '')
    //     self.filtered_scope = self.indexData;
    //   else {
    //     console.log(self.indexData);
    //     let filtered_by_scope = self.indexData.filter(function (e) {
     
    //       return e.scope == self.selectedScope;
    //     });
    //     self.filtered_scope = filtered_by_scope;
    //   }
    //   //Region Filter
    //   if (this.selectedRegion == '')
    //     self.filtered_region = self.filtered_scope;
    //   else {
    //     let filtered_by_region = self.filtered_scope.filter(function (e) {
    //       return e.region.some(reg_element => reg_element == self.selectedRegion);
    //     });
    //     self.filtered_region = filtered_by_region;
    //   }
    //   //Topic Area Filter
    //   if (this.selectedArea == '')
    //     self.filtered_area = self.filtered_region;
    //   else {
    //     let filtered_by_area = self.filtered_region.filter(function (e) {
    //       return e.topic_areas.some(are_element => are_element == self.selectedArea);
    //     });
    //     self.filtered_area = filtered_by_area;
    //   }
    //   //Pandemic Filter
    //   if (this.selectedPhase == '')
    //     self.filtered_phase = self.filtered_area;
    //   else {
    //     let filtered_by_phase = self.filtered_area.filter(function (e) {
    //       return e.pandemic_phase.some(ph_element => ph_element == self.selectedPhase);
    //     });
    //     self.filtered_phase = filtered_by_phase;
    //   }
    //   self.filterData = self.filtered_phase;
    // }
  }
});


