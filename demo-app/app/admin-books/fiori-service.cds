using { AdminService } from '../../srv/admin-service';
using from '../common'; // to help UI linter get the complete annotations



////////////////////////////////////////////////////////////////////////////
//
//	Books Object Page
//

annotate AdminService.Books with @(
  UI: {
    HeaderInfo: {
      Description: {Value: author_ID}
    },
    Facets: [
      {$Type: 'UI.ReferenceFacet', Label: '{i18n>General}', Target: '@UI.FieldGroup#General'},
      {$Type: 'UI.ReferenceFacet', Label: '{i18n>Details}', Target: '@UI.FieldGroup#Details'},
      {$Type: 'UI.ReferenceFacet', Label: '{i18n>Admin}', Target: '@UI.FieldGroup#Admin'},
    ],
    FieldGroup#General: {
      Data: [
        {Value: title},
        {Value: author_ID},
        {
          $Type: 'UI.DataFieldForAction',
          Action: 'AdminService.createAuthor',
          Label: 'Neuen Autor anlegen'
        },
        {Value: genre_ID},
        {
          $Type: 'UI.DataFieldForAction',
          Action: 'AdminService.createGenre',
          Label: 'Neues Genre anlegen'
        },
        {Value: descr},
      ]
    },
    FieldGroup#Details: {
      Data: [
        {Value: stock},
        {Value: price},
      ]
    },
    FieldGroup#Admin: {
      Data: [
        {Value: createdBy},
        {Value: createdAt},
        {Value: modifiedBy},
        {Value: modifiedAt}
      ]
    }
  }
);

////////////////////////////////////////////////////////////////////////////
//
//	Value Help for Tree Table
//
annotate AdminService.Books with {
  genre @(Common: {
    Label    : 'Genre',
    ValueList: {
      CollectionPath                : 'Genres',
        Parameters                  : [
        {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'name',
        },
        {
            $Type            : 'Common.ValueListParameterInOut',
            LocalDataProperty: genre_ID,
            ValueListProperty: 'ID',
        }
      ],
    }
  });
}

// Hide ID because of the ValueHelp
annotate AdminService.Genres with {
  ID @UI.Hidden;
};

annotate AdminService.Books with @odata.draft.enabled;

// Workaround for Fiori popup for asking user to enter a new UUID on Create
annotate AdminService.Books with { ID @Core.Computed; }
