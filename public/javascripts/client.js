$(function(){				
    $('.gpio-checkbox').on('change', function(e){        
        var data = {};
        data.action = "write";
        data.gpio = $(this).data("gpio");
        data.status = this.checked;
        console.log(data);
        $.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            url: '/ajax',						
            error: function(data) {
                alert("Error");
            }
        });
    });				
});

// on startup set pin 26 on
$(function() {
  $.ajax({type: 'POST', url: '/ajax', contentType: 'application/json', data: JSON.stringify({action:"write", gpio:26, status: true})})
})
