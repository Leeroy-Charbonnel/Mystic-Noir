export const templates = {
    characters: {
        BasicInformation: {
            type: "group",
            label: "Basic Information",
            fields: {
                FullName: {
                    type: "text",
                    required: true
                },
                BirthDate: {
                    type: "date",
                    required: true
                },
                DeathDate: {
                    type: "date",
                    required: true
                },
                Occupation: {
                    type: "text"
                },
                Background: {
                    type: "textarea"
                }
            }

        },
        Appearance: {
            type: "group",
            label: "Appearance",
            fields: {
                Description: {
                    type: "textarea"
                },
                Accessories: {
                    type: "array:text"
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
                    type: "textarea"
                },
                Strengths: {
                    type: "array:text"
                },
                Weaknesses: {
                    type: "array:text"
                }
            }
        },
        Relationships: {
            type: "group",
            label: "Relationships",
            fields: {
                Family: {
                    type: "array:text"
                },
                FriendsAndAllies: {
                    type: "array:text"
                },
                EnemiesAndRivals: {
                    type: "array:text"
                },
                RomanticInterests: {
                    type: "array:text"
                }
            }
        },
        Other: {
            type: "group",
            label: "Other",
            fields: {
                AdditionalNotes: {
                    type: "textarea"
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
                    required: true
                },
                Description: {
                    type: "textarea"
                },
                Owner: {
                    type: "array:textarea"
                },
                ItemPhoto: {
                    type: "image"
                }
            }
        },
        Other: {
            type: "group",
            label: "Other",
            fields: {
                AdditionalNotes: {
                    type: "textarea"
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
                    required: true
                },
                BeginDate: {
                    type: "date"
                },
                EndDate: {
                    type: "date"
                },
                Location: {
                    type: "text"
                },
                Description: {
                    type: "textarea"
                }
            }
        },
        Participants: {
            type: "group",
            label: "Participants",
            fields: {
                AssociatedCharacters: {
                    type: "array:text"
                }
            }
        },
        Other: {
            type: "group",
            label: "Other",
            fields: {
                AdditionalNotes: {
                    type: "textarea"
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
                    required: true
                },
                MapImage: {
                    type: "image"
                }
            }
        },
        Appearance: {
            type: "group",
            label: "Appearance",
            fields: {
                Atmosphere: {
                    type: "textarea"
                },
                Description: {
                    type: "textarea"
                }
            }
        },
        Other: {
            type: "group",
            label: "Other",
            fields: {
                AdditionalNotes: {
                    type: "textarea"
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
                    required: true
                },
                BeginDate: {
                    type: "date"
                },
                EndDate: {
                    type: "date"
                },
                Synopsis: {
                    type: "textarea"
                }
            }
        },
        StoryDetails: {
            type: "group",
            label: "Story Details",
            fields: {
                StoryDetails: {
                    type: "array:textarea"
                }
            }
        },
        Associated: {
            type: "group",
            label: "Associated Elements",
            fields: {
                Characters: {
                    type: "array:text"
                },
                Locations: {
                    type: "array:text"
                },
                Events: {
                    type: "array:text"
                },
                Items: {
                    type: "array:text"
                }
            }
        },
        Other: {
            type: "group",
            label: "Other",
            fields: {
                AdditionalNotes: {
                    type: "textarea"
                }
            }
        }
    },
    Example: {
        //Simple text field
        textField: {
            type: "text",
            required: true
        },

        //Text area for longer content
        textareaField: {
            type: "textarea"
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
            type: "array:text"
        },

        //Array of text area fields
        arrayTextareaField: {
            type: "array:textarea"
        },

        //Image field
        imageField: {
            type: "image"
        },
        dateField: {
            type: "date"
        }
    }
};