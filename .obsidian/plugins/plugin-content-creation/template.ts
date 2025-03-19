export const templates = {
    characters: {
        BasicInformation: {
            FullName: "text",
            Age: "text",
            Occupation: "text",
            Background: "textarea"
        },
        Appearance: {
            Description: "textarea",
            Accessories: "array:text",
        },
        State: {
            Dead: "boolean",
            Injured: "boolean",
        },
        Personality: {
            GeneralTraits: "textarea",
            Strengths: "array:text",
            Weaknesses: "array:text",
        },
        Relationships: {
            Family: "array:text",
            FriendsAndAllies: "array:text",
            EnemiesAndRivals: "array:text",
            RomanticInterests: "array:text",
        },
        Other: {
            Belongings: "array:text",
            AdditionalNotes: "textarea"
        }
    },

    items: {
        BasicInformation: {
            Name: "text",
            Description: "textarea",
            Owner: "array:textarea",
        },
        AdditionalNotes: "textarea"
    },

    events: {
        BasicInformation: {
            Name: "text",
            Date: "text",
            Location: "text",
            Description: "textarea"
        },
        AdditionalNotes: "textarea"
    },

    locations: {
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
    },

    stories: {
        BasicInformation: {
            Name: "text",
            Date: "text",
            Synopsis: "textarea",
            Synopsis2: "textarea"
        },
        Characters: {
            Characters: "array:text",
        },
        Locations: {
            Locations: "array:text",
        },
        Events: {
            Event: "array:text",
        },
        Items: {
            Items: "array:text",
        },
        StoryDetails: {
            StoryDetails: "array:textarea"
        },
        AdditionalNotes: "textarea"
    }
};