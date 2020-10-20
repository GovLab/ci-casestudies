$(document).ready(function() {
  var target = $('.imagine-banner').hide(),
      items = $('.imagine-banner').children(),
      counter = 0;
  function bannerFade() {
      target.fadeIn(2000).delay( 1500 ).fadeOut(2000,function() {
          bannerFade();
      }).html(items[counter++]);
      if (counter == items.length) {
          counter = 0;
      } 
  }
  bannerFade();
});