export const TEMPLATES = {
  characters: {
    defaultFolder: '1. Characters',
    template: {
      BasicInformation: {
        FullName: "",
        Age: "",
        Occupation: "",
        Background: ""
      },
      Appearance: {
        Height: "",
        Build: "",
        Hair: "",
        Eyes: "",
        ClothingStyle: "",
        DefiningFeatures: ""
      },
      Personality: {
        GeneralTraits: "",
        Strengths: [],
        Weaknesses: [],
        HabitsAndQuirks: []
      },
      Relationships: {
        Family: [],
        FriendsAndAllies: [],
        EnemiesAndRivals: [],
        RomanticInterests: []
      },
      Belongings: [],
      AdditionalNotes: ""
    }
  },
  
  items: {
    defaultFolder: '2. Items',
    template: {
      BasicInformation: {
        Name: "",
        Owner: "",
        Description: "",
        Value: ""
      },
      History: {
        Origin: "",
        Age: "",
        PreviousOwners: []
      },
      Significance: {
        Purpose: "",
        CulturalMeaning: ""
      },
      CurrentStatus: {
        Condition: "",
        Location: "",
        Accessibility: ""
      },
      AdditionalNotes: ""
    }
  },
  
  events: {
    defaultFolder: '5. Evenements',
    template: {
      BasicInformation: {
        Name: "",
        Type: "",
        Description: "",
        Date: "",
        Location: ""
      },
      Participants: {
        MainParticipants: [],
        Spectators: [],
        KeyFigures: []
      },
      History: {
        Origin: "",
        SignificantPastOccurrences: [],
        CulturalOrPoliticalImpact: ""
      },
      Details: {
        Agenda: [],
        TraditionsOrRituals: [],
        RulesOrGuidelines: ""
      },
      CurrentStatus: {
        Ongoing: false,
        NextOccurrence: "",
        PublicPerception: ""
      },
      AdditionalNotes: ""
    }
  },
  
  locations: {
    defaultFolder: '3. Locations',
    template: {
      BasicInformation: {
        Name: "",
        Type: "",
        Address: "",
        Owner: ""
      },
      Appearance: {
        Exterior: "",
        Interior: "",
        Size: "",
        DistinguishingFeatures: ""
      },
      Atmosphere: {
        Lighting: "",
        Sounds: "",
        Smells: "",
        Mood: ""
      },
      PurposeAndHistory: {
        PrimaryUse: "",
        History: "",
        Significance: ""
      },
      AssociatedCharacters: [],
      AdditionalNotes: ""
    }
  }
};

// Helper to get a display name from a camelCase or PascalCase property
export function getDisplayName(name: string): string {
  // Convert camelCase or PascalCase to spaced words
  const result = name.replace(/([A-Z])/g, ' $1').trim();
  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}

// Helper function to check if a value is an array
export function isArray(value: any): boolean {
  return Array.isArray(value);
}

// Helper function to check if a value is an object
export function isObject(value: any): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Helper function to check if a value is a boolean
export function isBoolean(value: any): boolean {
  return typeof value === 'boolean';
}