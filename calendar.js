var grid;
var data = [];
var dataView;
var sortcol = "p";
var new_counter = 0;

function createGrid(e) {
   function requiredFieldValidator(value) {
      if (value == null || value == undefined || !value.length) {
         return {
            valid: false,
            msg: "This is a required field"
         };
      } else {
         return {
            valid: true,
            msg: null
         };
      }
   }

   var columns = [
      {
         id: "p",
         name: "Property",
         field: "p",
         width: 120,
         editor: TextCellEditor,
         validator: requiredFieldValidator,
         sortable: true
      },
      {
         id: "v",
         name: "Value",
         field: "v",
         width: 480,
         editor: TextCellEditor,
         sortable: true
      }
   ];

   var options = {
      editable: true,
      enableAddRow: true,
      enableCellNavigation: true,
      enableColumnReorder: false,
      asyncEditorLoading: false,
      forceFitColumns: true,
      autoEdit: false
   };

   var extended_properties = e.getExtendedProperties();

   data = [];

   for (var i = 0; i < extended_properties.length; i++) {
      var p = extended_properties[i];

      var d = (data[i] = {});

      d["id"] =  i;

      d["p"] = p.name;
      d["v"] = p.value;
   }

   dataView = new Slick.Data.DataView();

   grid = new Slick.Grid("#grid", dataView, columns, options);

   grid.setSelectionModel(new Slick.RowSelectionModel());

   function comparer(a, b) {
      var x = a[sortcol];
      var y = b[sortcol];

      return (x == y ? 0 : (x > y ? 1 : -1));
   }

   grid.onSort.subscribe(function(e, args) {
      sortcol = args.sortCol.field;

      dataView.sort(comparer, args.sortAsc);
   });

   grid.onCellChange.subscribe(function(e,args) {
      dataView.updateItem(args.item.id, args.item);
   });

   grid.onAddNewRow.subscribe(function(e, args) {
      new_counter++;

      var item = {
         id: "new_" + new_counter,
         p: "New Property",
         v: "Default value"
      };

      $.extend(item, args.item);

      dataView.addItem(item);
   });

   dataView.onRowCountChanged.subscribe(function(e, args) {
      grid.updateRowCount();
      grid.render();
   });

   dataView.onRowsChanged.subscribe(function(e, args) {
      grid.invalidateRows(args.rows);
      grid.render();
   });

   dataView.beginUpdate();
   dataView.setItems(data);
   dataView.endUpdate();
}

function loaded() {
   $("#go").click(function() {
      retrieveCalendars();
   });

   $("#go").attr("disabled", false);
}

function handleError(e) {
   alert("error: " + (e.cause ? e.cause.statusText : e.message));
}

function queryCalendars(uri) {
   var calendarService = new google.gdata.calendar.CalendarService('bam-calendar');

   calendarService.getAllCalendarsFeed(uri,
   function(root) {
      $("#calendars").show();

      var entries = root.feed.getEntries();

      for (var r in entries) {
         var entry = entries[r];

         var c = {};

         c.title = entry.getTitle().getText();
         c.color = entry.getColor().getValue();

         c.id = entry.getId().getValue();

         $('<li />', {
            click: (function(current_c) {
               return function() {
                  queryCalendarEvents(current_c.id);
               }
            })(c),
            html: c.title,
            css: {
               backgroundColor: c.color
            }
         }).appendTo("#calendars");
      }
   },
   handleError);
}

function retrieveCalendars() {
   var scope = "http://www.google.com/calendar/feeds/";

   if (google.accounts.user.login(scope)) {
      $("#go").attr("disabled", "disabled");

      queryCalendars('http://www.google.com/calendar/feeds/default/allcalendars/full');
   }
}

function callback(result) {
   var entries = result.feed.entry;

   $("#results").html('');
   $("#results").show();

   for (var i = 0; i < entries.length; i++ ) {
      var e = entries[i];

      //var eventTime = e.getTimes()[0];

      //var start = eventTime.getStartTime().getDate();
      //var end = eventTime.getEndTime().getDate();

      var li = $('<li />').appendTo("#results");

      $("<span />", {
         html: e.getTitle().getText(),
         click: (function(current_e) {
            return function() {
               $('#grid, #save-button, #cancel-button').remove();

               var container = $(this).parent().eq(0);

               $('<div />', {
                  id: 'grid'
               }).appendTo(container);

               $('<input />', {
                  id: 'save-button',
                  value: "Save properties",
                  type: 'button',
                  click: (function(clicked_e, container) {
                     return function() {
                        if (!Slick.GlobalEditorLock.commitCurrentEdit()) {
                           return;
                        }

                        $('#save-button').attr('disabled', 'disabled');

                        $('#cancel-button').next().remove();

                        var properties = [];

                        for (var i = 0; i < dataView.getLength(); i++) {
                           var item = dataView.getItem(i);

                           if (!item.p || !item.v || item.p == "") {
                              continue;
                           }

                           var extendedProperty = new google.gdata.ExtendedProperty();

                           extendedProperty.setName(item.p);
                           extendedProperty.setValue(item.v);

                           properties.push(extendedProperty);
                        }

                        clicked_e.setExtendedProperties(properties);

                        clicked_e.updateEntry(
                           function(result) {
                              if (result.entry) {
                                 $('#save-button').attr('disabled', false);

                                 $('#cancel-button').next().remove();
                                 $('#cancel-button').after('<span class="result">Saved.</span>');
                              }
                           },
                           handleError
                        );
                     }
                  })(current_e)
               }).appendTo(container);

               $('<input />', {
                  id: 'cancel-button',
                  value: 'Cancel',
                  type: 'button',
                  click: function() {
                     $('#grid, #save-button, #cancel-button').remove();
                  }
               }).appendTo(container);

               createGrid(current_e);
            }
         })(e)
      }).appendTo(li);
   }
}

function queryCalendarEvents(id) {
   var calendarService = new google.gdata.calendar.CalendarService('bam-calendar');

   var uri = id.replace('default/calendars/', '') + "/private/full";

   var query = new google.gdata.calendar.CalendarEventQuery(uri);

   // Create and set the minimum start time for the date query
   var startMin = new google.gdata.DateTime(Date.today(), true);

   query.setMinimumStartTime(startMin);

   query.setOrderBy('starttime');
   query.setSortOrder('ascending');

   // Submit the request using the calendar service object
   calendarService.getEventsFeed(query, callback, handleError);
}

google.load('gdata', '2', { packages: ['calendar'] });
google.setOnLoadCallback(loaded);
