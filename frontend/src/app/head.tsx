"use client"

import { useTranslation } from 'react-i18next'

export default function Head() {
  const { t } = useTranslation('common')
  
  return (
    <>
      <title>{t('app.name')}</title>
      <meta name="description" content="Survey and feedback management platform" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/favicon.ico" />
    </>
  )
} 