"use client"

import { useTranslation } from "react-i18next"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Template } from "@/types/template"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"

interface TemplateDetailProps {
  template: Template
}

export function TemplateDetail({ template }: TemplateDetailProps) {
  const { t } = useTranslation(['templates', 'dashboard'])

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <Tabs defaultValue="info">
      <TabsList className="mb-4">
        <TabsTrigger value="info">{t('detail.tabs.info')}</TabsTrigger>
        <TabsTrigger value="questions">{t('detail.tabs.questions', 'Questions')}</TabsTrigger>
        <TabsTrigger value="clusters">{t('detail.tabs.clusters')}</TabsTrigger>
      </TabsList>

      <TabsContent value="info">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.basicInfo')}</CardTitle>
              <CardDescription>{t('dashboard:templates.details.basicInfoDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-3 gap-4">
                <div className="col-span-1 font-semibold">{t('detail.title')}</div>
                <div className="col-span-2">{template.title}</div>

                <div className="col-span-1 font-semibold">{t('detail.description')}</div>
                <div className="col-span-2">{template.description}</div>

                <div className="col-span-1 font-semibold">{t('detail.format')}</div>
                <div className="col-span-2">{template.format}</div>

                <div className="col-span-1 font-semibold">{t('detail.type')}</div>
                <div className="col-span-2">{template.type}</div>

                <div className="col-span-1 font-semibold">{t('detail.languages')}</div>
                <div className="col-span-2">
                  {template.languages?.map(lang => (
                    <Badge key={lang} className="mr-1">{lang}</Badge>
                  ))}
                </div>

                <div className="col-span-1 font-semibold">{t('detail.createdAt')}</div>
                <div className="col-span-2">{formatDate(template.created_at)}</div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard:templates.details.attributes')}</CardTitle>
              <CardDescription>{t('dashboard:templates.details.attributesDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-3 gap-4">
                <div className="col-span-1 font-semibold">{t('detail.analysisCluster')}</div>
                <div className="col-span-2">{template.analysis_cluster || t('dashboard:templates.notSpecified')}</div>

                <div className="col-span-1 font-semibold">{t('detail.status')}</div>
                <div className="col-span-2">
                  <Badge variant={template.is_active ? "default" : "secondary"}>
                    {template.is_active ? t('status.active') : t('status.inactive')}
                  </Badge>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="questions">
        <Card>
          <CardHeader>
            <CardTitle>{t('detail.questions')}</CardTitle>
            <CardDescription>{t('dashboard:templates.questions.description', 'Questions included in this template')}</CardDescription>
          </CardHeader>
          <CardContent>
            {template.questions && template.questions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>{t('detail.question')}</TableHead>
                    <TableHead className="w-32">{t('detail.questionType')}</TableHead>
                    <TableHead className="w-24">{t('detail.required')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {template.questions.map((question, index) => (
                    <TableRow key={question.id || index}>
                      <TableCell className="font-medium">{question.order}</TableCell>
                      <TableCell>
                        {Object.entries(question.questions).map(([lang, text]) => (
                          <div key={lang} className="mb-1">
                            <Badge variant="outline" className="mr-2">{lang}</Badge>
                            {text}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell>
                        {question.type === 'nps' ? 'NPS (0-10)' : 'Free Text'}
                      </TableCell>
                      <TableCell>
                        {question.is_required ? 
                          <Badge variant="default">{t('detail.required')}</Badge> : 
                          <Badge variant="outline">Optional</Badge>
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-6">
                {t('detail.noQuestions')}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="clusters">
        <Card>
          <CardHeader>
            <CardTitle>{t('detail.clusters')}</CardTitle>
            <CardDescription>{t('dashboard:templates.clusters.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            {template.clusters && template.clusters.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('dashboard:templates.clusters.name')}</TableHead>
                    <TableHead>{t('dashboard:templates.clusters.description')}</TableHead>
                    <TableHead>{t('dashboard:templates.clusters.keywords')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {template.clusters.map(cluster => (
                    <TableRow key={cluster.id}>
                      <TableCell className="font-medium">{cluster.name}</TableCell>
                      <TableCell>{cluster.description}</TableCell>
                      <TableCell>
                        {cluster.keywords?.map((keyword, i) => (
                          <Badge key={i} variant="outline" className="mr-1 mb-1">
                            {keyword}
                          </Badge>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-6">
                {t('detail.noClusters')}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
} 