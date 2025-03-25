export const templates = {
    characters: {
        BasicInformation: {
            FullName: {
                type: "text",
                required: true,
                placeholder: "Character's full name"
            },
            BirthDate: {
                type: "date",
                required: true,
                placeholder: "dd/mm/yyyy"
            },
            DeathDate: {
                type: "date",
                required: true,
                placeholder: "dd/mm/yyyy",
            },
            Occupation: {
                type: "text",
                placeholder: "Character's occupation or role"
            },
            Background: {
                type: "textarea",
                placeholder: "Character's background story"
            }
        },
        Appearance: {
            Description: {
                type: "textarea",
                placeholder: "Description of the character"
            },
            Accessories: {
                type: "array:text",
                placeholder: "Add an accessory"
            },
        },
        State: {
            CurrentStatus: {
                type: "badges",
                options: ["Dead", "Injured", "Missing", "Imprisoned", "Exiled", "Unknown"]
            }
        },
        Personality: {
            GeneralTraits: {
                type: "textarea",
                placeholder: "Overall personality description"
            },
            Strengths: {
                type: "array:text",
                placeholder: "Add a strength"
            },
            Weaknesses: {
                type: "array:text",
                placeholder: "Add a weakness"
            }
        },
        Relationships: {
            Family: {
                type: "array:text",
                placeholder: "Add a family relationship"
            },
            FriendsAndAllies: {
                type: "array:text",
                placeholder: "Add a friend or ally"
            },
            EnemiesAndRivals: {
                type: "array:text",
                placeholder: "Add an enemy or rival"
            },
            RomanticInterests: {
                type: "array:text",
                placeholder: "Add a romantic interest"
            },
        },
        Other: {
            AdditionalNotes: {
                type: "textarea",
                placeholder: "Any other notes about this character"
            }
        }
    },

    items: {
        BasicInformation: {
            Name: {
                type: "text",
                required: true,
                placeholder: "Item name"
            },
            Description: {
                type: "textarea",
                placeholder: "Item description"
            },
            Owner: {
                type: "array:textarea",
                placeholder: "Add an owner with details"
            },
            ItemPhoto: {
                type: "image",
                placeholder: "Visual representation of the item"
            }
        },
        Other: {
            AdditionalNotes: {
                type: "textarea",
                placeholder: "Any other notes about this item"
            }
        }
    },

    events: {
        BasicInformation: {
            Name: {
                type: "text",
                required: true,
                placeholder: "Event name"
            },
            BeginDate: {
                type: "date",
                placeholder: "When the event began"
            },
            EndDate: {
                type: "date",
                placeholder: "When the event ended"
            },
            Location: {
                type: "text",
                placeholder: "Where the event occurred"
            },
            Description: {
                type: "textarea",
                placeholder: "Event description"
            }
        },
        AssociatedCharacters: {
            type: "array:text",
            placeholder: "Add a character associated with this event"
        },
        Other: {
            AdditionalNotes: {
                type: "textarea",
                placeholder: "Any other notes about this event"
            }
        }
    },

    locations: {
        BasicInformation: {
            Name: {
                type: "text",
                required: true,
                placeholder: "Location name"
            },
            MapImage: {
                type: "image",
                placeholder: "Map or image of the location"
            }
        },
        Appearance: {
            Atmosphere: {
                type: "textarea",
                placeholder: "Atmosphere description"
            },
            Description: {
                type: "textarea",
                placeholder: "Visual description of the location"
            }
        },

        Other: {
            AdditionalNotes: {
                type: "textarea",
                placeholder: "Any other notes about this location"
            }
        }
    },

    stories: {
        BasicInformation: {
            Name: {
                type: "text",
                required: true,
                placeholder: "Story title"
            },
            BeginDate: {
                type: "date",
                placeholder: "When the story begins"
            },
            EndDate: {
                type: "date",
                placeholder: "When the story ends"
            },
            Synopsis: {
                type: "textarea",
                placeholder: "Brief summary of the story"
            }
        },
        StoryDetails: {
            StoryDetails: {
                type: "array:textarea",
                placeholder: "Add a story detail"
            }
        },
        Associated: {
            Characters: {
                Characters: {
                    type: "array:text",
                    placeholder: "Add a character"
                },
            },
            Locations: {
                Locations: {
                    type: "array:text",
                    placeholder: "Add a location"
                },
            },
            Events: {
                Events: {
                    type: "array:text",
                    placeholder: "Add an event"
                },
            },
            Items: {
                Items: {
                    type: "array:text",
                    placeholder: "Add an item"
                },
            }
        },
        Other: {
            AdditionalNotes: {
                type: "textarea",
                placeholder: "Any other notes about this story"
            }
        }
    },
    Example: {
        //Simple text field
        textField: {
            type: "text",
            required: true,
            placeholder: "Enter text here"
        },

        //Text area for longer content
        textareaField: {
            type: "textarea",
            placeholder: "Enter longer text here"
        },

        //Boolean field (checkbox)
        booleanField: {
            type: "boolean",
            default: false
        },

        //Dropdown field
        dropdownField: {
            type: "dropdown",
            options: ["Option 1", "Option 2", "Option 3"],
            allowCustom: true //Allow user to enter custom values
        },

        //Badges field (similar to dropdown but displayed differently)
        badgesField: {
            type: "badges",
            options: ["Badge 1", "Badge 2", "Badge 3"]
        },

        //Array of text fields
        arrayTextField: {
            type: "array:text",
            placeholder: "Add a new text item"
        },

        //Array of text area fields
        arrayTextareaField: {
            type: "array:textarea",
            placeholder: "Add a new text area item"
        },

        //Image field
        imageField: {
            type: "image",
            placeholder: "Upload an image"
        },
        dateField: {
            type: "date",
            placeholder: "Select a date"
        }
    }
};
