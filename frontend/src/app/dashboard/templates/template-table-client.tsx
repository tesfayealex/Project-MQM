"use client"

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast, useToast } from '@/components/ui/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import TemplateTable from '@/components/templates/TemplateTable'
import { Template } from '@/types/template'
import { useTranslation } from 'react-i18next'
import { deleteTemplate } from '@/lib/services/template-service'
import { handleAuthError } from '@/lib/auth-utils'

interface TemplateTableClientProps {
  initialTemplates: Template[]
}

export default function TemplateTableClient({ initialTemplates }: TemplateTableClientProps) {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>(initialTemplates || [])
  const [isDeleting, setIsDeleting] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null)
  const { toast } = useToast()
  const { t, i18n } = useTranslation('templates', { useSuspense: false })
  
  // Load templates namespace
  React.useEffect(() => {
    i18n.loadNamespaces('templates').catch(err => 
      console.error('Failed to load templates namespace:', err)
    );
  }, [i18n]);

  const handleDelete = async () => {
    if (!templateToDelete) return

    setIsDeleting(true)
    try {
      await deleteTemplate(templateToDelete)
      
      // Update local state
      setTemplates(templates.filter(template => template.id.toString() !== templateToDelete))
      
      toast({
        title: t('messages.deleted'),
        description: t('messages.deleted'),
      })

      // Reset state
      setTemplateToDelete(null)
      
      // Refresh the page data
      router.refresh()
    } catch (error: any) {
      console.error('Error deleting template:', error)
      
      // Handle authentication errors
      const isAuthError = await handleAuthError(error);
      if (!isAuthError) {
        toast({
          variant: 'destructive',
          title: t('messages.error'),
          description: error.message || t('messages.error'),
        })
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const onDeleteClick = (id: string) => {
    setTemplateToDelete(id)
  }

  const cancelDelete = () => {
    setTemplateToDelete(null)
  }

  return (
    <>
      <TemplateTable templates={templates} onDelete={onDeleteClick} />
      
      <AlertDialog open={!!templateToDelete} onOpenChange={cancelDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messages.confirm_delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('messages.confirm_delete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('create.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? t('actions.delete') + '...' : t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
} 