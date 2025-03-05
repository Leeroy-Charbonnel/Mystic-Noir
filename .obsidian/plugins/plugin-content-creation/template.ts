export const templates={
    tests: {
        FullName: "text",
    },
    characters: {
        BasicInformation: {
            FullName: "text",
            Age: "text",
            Occupation: "text",
            Background: "textarea"
        },
        Appearance: {
            Build: "text",
            Description: "textarea",
            Accessories: "array:text",
        },
        State: {
            Dead: "boolean",
            Injured: "boolean",
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
        Other: {
            Belongings: "array:text",
            AdditionalNotes: "textarea"
        }
    },

    items: {
        BasicInformation: {
            Name: "text",
            Description: "textarea",
            Owner: "array:text",
        },
        AdditionalNotes: "textarea"
    },

    events: {
        BasicInformation: {
            Name: "text",
            Description: "textarea",
            Date: "text",
            Location: "text"
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
};