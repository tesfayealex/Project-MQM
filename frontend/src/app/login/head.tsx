"use client"

import { useTranslation } from 'react-i18next'

export default function Head() {
  const { t } = useTranslation(['common', 'login'])
  
  return (
    <>
      <title>{t('common:app.name')} - {t('login:title')}</title>
      <meta name="description" content={t('login:subtitle')} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/favicon.ico" />
    </>
  )
} 