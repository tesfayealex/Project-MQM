"use client"

import { useTranslation } from 'react-i18next'

export default function Head() {
  const { t } = useTranslation(['common', 'dashboard'])
  
  return (
    <>
      <title>{t('common:app.name')} - {t('dashboard:welcome')}</title>
      <meta name="description" content={t('dashboard:overview')} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/favicon.ico" />
    </>
  )
} 