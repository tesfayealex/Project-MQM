# Internationalization (i18n) in myQuickMessage

This document explains how to use and extend the internationalization features in the myQuickMessage application.

## Overview

The application supports multiple languages with easy switching between them. Currently supported languages are:

- English (en)
- French (fr)
- Spanish (es)

## How it Works

The implementation uses:
- `i18next` for translation management
- `react-i18next` for component-level translations
- `i18next-browser-languagedetector` for language detection
- `i18next-http-backend` for loading translations dynamically
- Cookie-based language persistence

## Directory Structure

All translations are stored in JSON files under:
```
/public/locales/{language-code}/{namespace}.json
```

For example:
- `/public/locales/en/common.json` - English common translations
- `/public/locales/fr/dashboard.json` - French dashboard translations

## Namespaces

Translations are organized by namespaces to keep them modular:

- `common.json` - Shared translations used across the application
- `dashboard.json` - Dashboard-specific translations
- (Add more namespaces as needed)

## Adding a New Language

To add a new language:

1. Create a new folder under `/public/locales/` with the language code (e.g., `de` for German)
2. Copy all JSON files from an existing language folder (e.g., `/public/locales/en/`)
3. Translate all values in the copied JSON files
4. Add the new language code to:
   - The supported languages list in `src/lib/i18n.ts`
   - The language list in `frontend/middleware.ts`
   - The language options in `src/components/language-selector.tsx`

## Using Translations in Components

To use translations in a component:

```jsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation('namespace');
  
  return <h1>{t('key.to.translation')}</h1>;
}
```

For translations that appear in multiple components, use the `common` namespace.

## Adding New Translations

When adding new text to the application:

1. Add a new key-value pair in the appropriate JSON file(s) for each supported language
2. Use hierarchical keys for organization (e.g., `surveys.active.title`)
3. Use the `t()` function to reference the key in your component

## Handling Dynamic Content

For translations with dynamic values:

```json
{
  "welcome": "Welcome, {{name}}!"
}
```

In your component:
```jsx
t('welcome', { name: userName })
```

## Language Switching Implementation

The language switching is implemented using:

1. A dedicated `LanguageContext` that provides the current locale and a way to change it
2. A `LanguageSelector` component in the sidebar for users to select their preferred language
3. Cookies to persist the language preference
4. A middleware that handles redirects based on the user's language preference

When a user changes their language preference:
1. The new language is stored in a cookie
2. The i18n instance changes the active language
3. The page reloads to ensure all components use the new language

## Tips for Internationalization

1. **Avoid string concatenation**: Use variables in translations instead
2. **Consider pluralization**: Use the i18next pluralization features for counting
3. **Keep translations organized**: Use hierarchy and namespaces
4. **Test all languages**: Verify UI layout with longer translations

## Troubleshooting

- If translations aren't loading, check the browser network tab to see if the JSON files are being loaded correctly
- If a translation is missing, you'll see the key displayed instead
- Check the browser console for any i18n-related errors 