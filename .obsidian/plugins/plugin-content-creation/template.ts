export const templates = {
  tests:{
    name:"text",
    defaultFolder: '1. Characters',
  },
  characters: {
    defaultFolder: '1. Characters',
    template: {
      BasicInformation: {
        FullName: "text",
        Age: "text",
        Occupation: "text",
        Background: "textarea"
      },
      Appearance: {
        Build: "text",
        Description: "textarea",
        Accessories: "text",
      },
      State:{
          Dead:"boolean",
          Injured:"boolean",
      },
      Personality: {
        GeneralTraits: "",
        Strengths: "array:text",
        Weaknesses: "array:text",
      },
      Relationships: {
        Family: "array:text",
        FriendsAndAllies: "array:textarea",
        EnemiesAndRivals: "array:text",
        RomanticInterests: "array:text",
      },
      Belongings: "array:text",
      AdditionalNotes: "textarea"
    }
  },

  items: {
    defaultFolder: '2. Items',
    template: {
      BasicInformation: {
        Name: "text",
        Description: "textarea",
        Owner: "array:text",
      },
      AdditionalNotes: "textarea"
    }
  },

  events: {
    defaultFolder: '5. Events',
    template: {
      BasicInformation: {
        Name: "text",
        Description: "textarea",
        Date: "text",
        Location: "text"
      },
      AdditionalNotes: "textarea"
    }
  },

  locations: {
    defaultFolder: '3. Locations',
    template: {
      BasicInformation: {
        Name: "text",
        location: "text",
      },
      Appearance: {
        Description: "textarea",
        Detail: "textarea",
      },
      Atmosphere: {
        Description: "textarea"
      },
      AssociatedCharacters: "array:text",
      AdditionalNotes: "textarea"
    }
  },

  stories: {
    defaultFolder: '4. Stories',
    template: {
      BasicInformation: {
        Name: "text",
        Synopsis: "textarea"
      },
      Characters: {
        Characters: "array:text",
      },
      Locations: {
        Locations: "array:text",
      },
      Items: {
        Items: "array:text",
      },
      StoryDetails: {
        StoryDetails: "array:textarea"
      },
      AdditionalNotes: "textarea"
    }
  }
};