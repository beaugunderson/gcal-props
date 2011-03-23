var grid;
var data = [];
var dataView;
var sortcol = "p";
var new_counter = 0;
var scope = "https://www.google.com/calendar/feeds/";
var field_types = [];

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
         width: 150,
         editor: TextCellEditor,
         validator: requiredFieldValidator,
         sortable: true
      },
      {
         id: "v",
         name: "Value",
         field: "v",
         width: 450,
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
      autoEdit: true
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

   grid.onBeforeEditCell.subscribe(function(e, args) {
      if (field_types && arg.items) {
         if (field_types[args.item.p] == 'b') {
            args.column.editor = YesNoCheckboxCellEditor;
         } else {
            args.column.editor = TextCellEditor;
         }
      } else {
         args.column.editor = TextCellEditor;
      }
   });

   grid.onCellChange.subscribe(function(e, args) {
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

   // Add template fields if they don't already exist
   for (var i in field_types) {
      if (inData(data, i)) {
         continue;
      }

      new_counter++;

      var item = {
         id: "new_" + new_counter,
         p: i,
         v: ""
      };

      dataView.addItem(item);
   }

   dataView.endUpdate();
}

function inData(data, p) {
   for (var i = 0; i < data.length; i++) {
      if (data[i]['p'] == p) {
         return true;
      }
   }

   return false;
}

function loaded() {
   //#f%5BHomeFeatured%5D=b&f%5BSubFeatured%5D=b
   field_types = $.bbq.getState('f');

   try {
      if (google.accounts.user.checkLogin(scope)) {
         queryCalendars('https://www.google.com/calendar/feeds/default/allcalendars/full');
      } else {
         $("#go").click(function() {
            if (google.accounts.user.login(scope)) {
               $("#go").hide();
            }
         });

         $("#go").show();
      }
   } catch (e) {
      handleError(e);
   }
}

function handleError(e) {
   $("#error-text").text(e.cause ? e.cause.statusText : e.message);
   $("#error").show();
}

function queryCalendars(uri) {
   var calendarService = new google.gdata.calendar.CalendarService('bam-calendar');

   calendarService.getAllCalendarsFeed(uri, function(root) {
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
               // XXX This is a hack because even though we use only https URLs
               // Google returns the ID of calendars with an http:// protocol in
               // the feed.
               var id = current_c.id.replace('http://', 'https://');

               return function() {
                  queryCalendarEvents(id);
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

function callback(root) {
   var entries = root.feed.getEntries();

   $("#results").html('');
   $("#results").show();

   for (var i = 0; i < entries.length; i++ ) {
      var e = entries[i];

      var times = e.getTimes();

      // Dates for repeating events are returned in an
      // unspecified ordering so we have to sort them.
      times.sort(function(a, b) {
         var s1 = a.getStartTime().date;
         var s2 = b.getStartTime().date;

         return s2.compareTo(s1);
      });

      var eventTime = times[times.length - 1];

      var start = eventTime.getStartTime().getDate();
      var end = eventTime.getEndTime().getDate();

      var li = $('<li />').appendTo("#results");

      $("<span />", {
         html: sprintf('<span class="date">%s</span> %s', start.toString("MM/dd"), e.getTitle().getText()),
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
