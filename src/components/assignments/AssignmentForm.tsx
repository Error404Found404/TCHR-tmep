import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Save, X, Loader2, AlertCircle } from 'lucide-react'

interface NewHomework {
  grade: number
  section: string
  title: string
  description: string
  assignDate: string
  dueDate: string
  date: string
}

interface AssignmentFormProps {
  newHomework: NewHomework
  formErrors: Partial<Record<keyof NewHomework, string>>
  error: string | null
  saving: boolean
  editingAssignment: any
  grades: number[]
  getSectionsForGrade: (grade: number) => string[]
  handleInputChange: (field: keyof NewHomework, value: string | number) => void
  handleSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

export const AssignmentForm: React.FC<AssignmentFormProps> = React.memo(({
  newHomework,
  formErrors,
  error,
  saving,
  editingAssignment,
  grades,
  getSectionsForGrade,
  handleInputChange,
  handleSubmit,
  onCancel
}) => {
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{editingAssignment ? 'Edit Assignment' : 'Create New Assignment'}</DialogTitle>
      </DialogHeader>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          <AlertCircle className="h-4 w-4 mr-2 inline" />
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="grade">Grade *</Label>
            <Select
              value={newHomework.grade.toString()}
              onValueChange={(value) => handleInputChange('grade', parseInt(value))}
            >
              <SelectTrigger className={formErrors.grade ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                {grades.map((grade) => (
                  <SelectItem key={grade} value={grade.toString()}>
                    Grade {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formErrors.grade && <p className="text-sm text-red-500 mt-1">{formErrors.grade}</p>}
          </div>

          <div>
            <Label htmlFor="section">Section *</Label>
            <Select
              value={newHomework.section}
              onValueChange={(value) => handleInputChange('section', value)}
              disabled={!newHomework.grade}
            >
              <SelectTrigger className={formErrors.section ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                {newHomework.grade && getSectionsForGrade(newHomework.grade).map((section) => (
                  <SelectItem key={section} value={section}>
                    Section {section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formErrors.section && <p className="text-sm text-red-500 mt-1">{formErrors.section}</p>}
          </div>
        </div>

        <div>
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={newHomework.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="Enter assignment title"
            className={formErrors.title ? 'border-red-500' : ''}
          />
          {formErrors.title && <p className="text-sm text-red-500 mt-1">{formErrors.title}</p>}
        </div>

        <div>
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            value={newHomework.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Enter assignment description"
            className={formErrors.description ? 'border-red-500' : ''}
            rows={3}
          />
          {formErrors.description && <p className="text-sm text-red-500 mt-1">{formErrors.description}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="assignDate">Assign Date *</Label>
            <Input
              id="assignDate"
              type="date"
              value={newHomework.assignDate}
              onChange={(e) => handleInputChange('assignDate', e.target.value)}
              className={formErrors.assignDate ? 'border-red-500' : ''}
            />
            {formErrors.assignDate && <p className="text-sm text-red-500 mt-1">{formErrors.assignDate}</p>}
          </div>
          <div>
            <Label htmlFor="dueDate">Due Date *</Label>
            <Input
              id="dueDate"
              type="date"
              value={newHomework.dueDate}
              onChange={(e) => handleInputChange('dueDate', e.target.value)}
              className={formErrors.dueDate ? 'border-red-500' : ''}
            />
            {formErrors.dueDate && <p className="text-sm text-red-500 mt-1">{formErrors.dueDate}</p>}
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? 'Saving...' : (editingAssignment ? 'Update Assignment' : 'Create Assignment')}
          </Button>
        </div>
      </form>
    </DialogContent>
  )
})

AssignmentForm.displayName = 'AssignmentForm'
