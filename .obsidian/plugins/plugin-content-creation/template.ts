export const templates = {
    characters: {
        BasicInformation: {
            type: "group",
            label: "Basic Information",
            fields: {
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
            }

        },
        Appearance: {
            type: "group",
            label: "Appearance",
            fields: {
                Description: {
                    type: "textarea",
                    placeholder: "Description of the character"
                },
                Accessories: {
                    type: "array:text",
                    placeholder: "Add an accessory"
                }
            }
        },
        State: {
            type: "group",
            label: "State",
            fields: {
                CurrentStatus: {
                    type: "badges",
                    options: ["Dead", "Injured", "Missing", "Imprisoned", "Unknown"]
                }
            }
        },
        Personality: {
            type: "group",
            label: "Personality",
            fields: {
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
            }
        },
        Relationships: {
            type: "group",
            label: "Relationships",
            fields: {
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
                }
            }
        },
        Other: {
            type: "group",
            label: "Other",
            fields: {
                AdditionalNotes: {
                    type: "textarea",
                    placeholder: "Any other notes about this character"
                }
            }
        }
    },

    items: {
        BasicInformation: {
            type: "group",
            label: "Basic Information",
            fields: {
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
            }
        },
        Other: {
            type: "group",
            label: "Other",
            fields: {
                AdditionalNotes: {
                    type: "textarea",
                    placeholder: "Any other notes about this item"
                }
            }
        }
    },

    events: {
        BasicInformation: {
            type: "group",
            label: "Basic Information",
            fields: {
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
            }
        },
        Participants: {
            type: "group",
            label: "Participants",
            fields: {
                AssociatedCharacters: {
                    type: "array:text",
                    placeholder: "Add a character associated with this event"
                }
            }
        },
        Other: {
            type: "group",
            label: "Other",
            fields: {
                AdditionalNotes: {
                    type: "textarea",
                    placeholder: "Any other notes about this event"
                }
            }
        }
    },

    locations: {
        BasicInformation: {
            type: "group",
            label: "Basic Information",
            fields: {
                Name: {
                    type: "text",
                    required: true,
                    placeholder: "Location name"
                },
                MapImage: {
                    type: "image",
                    placeholder: "Map or image of the location"
                }
            }
        },
        Appearance: {
            type: "group",
            label: "Appearance",
            fields: {
                Atmosphere: {
                    type: "textarea",
                    placeholder: "Atmosphere description"
                },
                Description: {
                    type: "textarea",
                    placeholder: "Visual description of the location"
                }
            }
        },
        Other: {
            type: "group",
            label: "Other",
            fields: {
                AdditionalNotes: {
                    type: "textarea",
                    placeholder: "Any other notes about this location"
                }
            }
        }
    },

    stories: {
        BasicInformation: {
            type: "group",
            label: "Basic Information",
            fields: {
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
            }
        },
        StoryDetails: {
            type: "group",
            label: "Story Details",
            fields: {
                StoryDetails: {
                    type: "array:textarea",
                    placeholder: "Add a story detail"
                }
            }
        },
        Associated: {
            type: "group",
            label: "Associated Elements",
            fields: {
                Characters: {
                    type: "array:text",
                    placeholder: "Add a character"
                },
                Locations: {
                    type: "array:text",
                    placeholder: "Add a location"
                },
                Events: {
                    type: "array:text",
                    placeholder: "Add an event"
                },
                Items: {
                    type: "array:text",
                    placeholder: "Add an item"
                }
            }
        },
        Other: {
            type: "group",
            label: "Other",
            fields: {
                AdditionalNotes: {
                    type: "textarea",
                    placeholder: "Any other notes about this story"
                }
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