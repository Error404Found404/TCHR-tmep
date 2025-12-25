import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Save, Users, BookOpen, TrendingUp, Award, Plus, Edit, Trash2, Loader2 } from 'lucide-react'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'

// Updated interfaces to match your backend schema
interface Student {
  _id: string
  studentID: string
  firstName: string
  lastName?: string
  grade: number
  section?: string
  email: string
}

interface Mark {
  _id: string
  studentID: string
  subject: string
  marksObtained: number
  totalMarks: number
  examType: 'Midterm' | 'Final' | 'Class Test'
  semester: string
  date: string
}

type MarkValidationErrors = {
  studentID?: string;
  subject?: string;
  examType?: string;
  semester?: string;
  marksObtained?: string;
  totalMarks?: string;
};
interface NewMark {
  studentID: string
  subject: string
  marksObtained: number
  totalMarks: number
  examType: 'Midterm' | 'Final' | 'Class Test'
  semester: string
  date: string
}

interface StudentWithMarks extends Student {
  currentMark?: Mark
}


export const Marks: React.FC = () => {
  const [selectedGrade, setSelectedGrade] = useState<string>('')
  const [selectedSection, setSelectedSection] = useState<string>('')
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [selectedExamType, setSelectedExamType] = useState<'Midterm' | 'Final' | 'Class Test'>('Midterm')
  const [selectedSemester, setSelectedSemester] = useState<string>('')
  const [students, setStudents] = useState<StudentWithMarks[]>([])
  const [marks, setMarks] = useState<Mark[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddMark, setShowAddMark] = useState(false)
  const [editingMark, setEditingMark] = useState<Mark | null>(null)


  // Form state for adding/editing marks
  const [newMark, setNewMark] = useState<NewMark>({
    studentID: '',
    subject: '',
    marksObtained: 0,
    totalMarks: 100,
    examType: 'Midterm',
    semester: '',
    date: new Date().toISOString().split('T')[0]
  })

  const [formErrors, setFormErrors] = useState<MarkValidationErrors>({})

  // Use the teacher classes hook
  const {
    getAssignedGrades,
    getSectionsForGrade
  } = useTeacherClasses()

  // Get dynamic grades and sections based on teacher's assignments
  const grades = getAssignedGrades()
  const sections = selectedGrade
    ? getSectionsForGrade(parseInt(selectedGrade))
    : []
  const subjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Hindi', 'History', 'Geography', 'Computer Science']
  const examTypes: ('Midterm' | 'Final' | 'Class Test' | 'Exam type is required')[] = ['Midterm', 'Final', 'Class Test']
  const semesters = ['Spring 2024', 'Fall 2024', 'Spring 2025', 'Fall 2025']

  // API functions
  const fetchStudents = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('teacherToken')
      const response = await fetch('/api/teachers/students', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      })
      if (!response.ok) throw new Error('Failed to fetch students')
      const data = await response.json()

      // Filter students by selected grade and section
      let filteredStudents = data
      if (selectedGrade) {
        filteredStudents = filteredStudents.filter((s: Student) => s.grade.toString() === selectedGrade)
      }
      if (selectedSection) {
        filteredStudents = filteredStudents.filter((s: Student) => s.section === selectedSection)
      }

      setStudents(filteredStudents)
      setError(null)
    } catch (err) {
      console.error('Error fetching students:', err)
      setError('Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  const fetchMarksForStudents = async () => {
    if (!selectedSubject || !selectedExamType || !selectedSemester || students.length === 0) return

    try {
      setLoading(true)
      // Fetch marks for all students in the selected criteria
      const marksPromises = students.map(async (student) => {
        try {
          const token = localStorage.getItem('teacherToken')
          const response = await fetch(`/api/teachers/Marks/${student.studentID}`, {
            headers: {
              'Authorization': token ? `Bearer ${token}` : ''
            }
          })
          if (response.ok) {
            const data = await response.json()
            // Filter marks by subject, examType, and semester
            const relevantMarks: Mark[] = []
            Object.values(data).flat().forEach((mark: any) => {
              if (mark.subject === selectedSubject &&
                mark.examType === selectedExamType &&
                mark.semester === selectedSemester) {
                relevantMarks.push(mark)
              }
            })
            return relevantMarks
          }
          return []
        } catch (err) {
          console.error(`Error fetching marks for student ${student.studentID}:`, err)
          return []
        }
      })

      const allMarks = await Promise.all(marksPromises)
      const flatMarks = allMarks.flat()
      setMarks(flatMarks)

      // Update students with their current marks
      const updatedStudents = students.map(student => {
        const currentMark = flatMarks.find(mark => mark.studentID === student.studentID)
        return { ...student, currentMark }
      })
      setStudents(updatedStudents)
    } catch (err) {
      console.error('Error fetching marks:', err)
      setError('Failed to load marks')
    } finally {
      setLoading(false)
    }
  }

  const createMark = async (markData: NewMark) => {
    try {
      setSaving(true)
      const token = localStorage.getItem('teacherToken')
      const response = await fetch('/api/teachers/Marks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(markData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create mark')
      }

      await fetchMarksForStudents() // Refresh marks
      return await response.json()
    } catch (err) {
      console.error('Error creating mark:', err)
      throw err
    } finally {
      setSaving(false)
    }
  }

  const updateMark = async (markId: string, markData: Partial<NewMark>) => {
    try {
      setSaving(true)
      const token = localStorage.getItem('teacherToken')
      const response = await fetch(`/api/teachers/Marks/${markId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(markData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update mark')
      }

      await fetchMarksForStudents() // Refresh marks
      return await response.json()
    } catch (err) {
      console.error('Error updating mark:', err)
      throw err
    } finally {
      setSaving(false)
    }
  }

  const deleteMark = async (markId: string) => {
    try {
      setSaving(true)
      const token = localStorage.getItem('teacherToken')
      const response = await fetch(`/api/teachers/Marks/${markId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete mark')
      }

      await fetchMarksForStudents() // Refresh marks
    } catch (err) {
      console.error('Error deleting mark:', err)
      throw err
    } finally {
      setSaving(false)
    }
  }

  // Load students when grade/section changes
  useEffect(() => {
    if (selectedGrade) {
      fetchStudents()
    }
  }, [selectedGrade, selectedSection])

  // Load marks when subject/exam/semester changes
  useEffect(() => {
    if (selectedSubject && selectedExamType && selectedSemester && students.length > 0) {
      fetchMarksForStudents()
    }
  }, [selectedSubject, selectedExamType, selectedSemester, students.length])

  // Reset section when grade changes
  useEffect(() => {
    setSelectedSection('')
  }, [selectedGrade])

  // Quick update marks function (for inline editing)
  const quickUpdateMark = async (studentID: string, marksObtained: number) => {
    const student = students.find(s => s.studentID === studentID)
    if (!student) return

    try {
      if (student.currentMark) {
        // Update existing mark
        await updateMark(student.currentMark._id, { marksObtained })
      } else {
        // Create new mark
        const newMarkData: NewMark = {
          studentID,
          subject: selectedSubject,
          marksObtained,
          totalMarks: 100,
          examType: selectedExamType,
          semester: selectedSemester,
          date: new Date().toISOString()
        }
        await createMark(newMarkData)
      }
      setHasChanges(false)
    } catch (err: any) {
      setError(err.message || 'Failed to update mark')
    }
  }

  // Handle inline marks change
  const handleMarksChange = (studentID: string, value: string) => {
    const marksObtained = value === '' ? 0 : parseInt(value)

    // Update local state immediately for better UX
    const updatedStudents = students.map(student => {
      if (student.studentID === studentID) {
        const updatedMark = student.currentMark
          ? { ...student.currentMark, marksObtained }
          : {
            _id: 'temp',
            studentID,
            subject: selectedSubject,
            marksObtained,
            totalMarks: 100,
            examType: selectedExamType,
            semester: selectedSemester,
            date: new Date().toISOString()
          } as Mark

        return { ...student, currentMark: updatedMark }
      }
      return student
    })

    setStudents(updatedStudents)
    setHasChanges(true)
  }

  // Save all changes
  const saveAllChanges = async () => {
    try {
      setSaving(true)
      const promises = students
        .filter(student => student.currentMark && student.currentMark._id !== 'temp')
        .map(student => quickUpdateMark(student.studentID, student.currentMark!.marksObtained))

      await Promise.all(promises)
      setHasChanges(false)
      alert('All marks saved successfully!')
    } catch (err) {
      console.error('Error saving marks:', err)
      setError('Failed to save marks')
    } finally {
      setSaving(false)
    }
  }

  // Calculate statistics
  const getStatistics = () => {
    const validMarks = students
      .filter(student => student.currentMark)
      .map(student => student.currentMark!.marksObtained)

    if (validMarks.length === 0) {
      return { average: 0, highest: 0, lowest: 0, passed: 0, total: 0 }
    }

    const average = validMarks.reduce((sum, mark) => sum + mark, 0) / validMarks.length
    const highest = Math.max(...validMarks)
    const lowest = Math.min(...validMarks)
    const passed = validMarks.filter(mark => mark >= 40).length

    return { average, highest, lowest, passed, total: validMarks.length }
  }

  // Form validation
  const validateForm = (): boolean => {
    const errors: MarkValidationErrors = {}

    if (!newMark.studentID) errors.studentID = 'Student is required'
    if (!newMark.subject) errors.subject = 'Subject is required'
    if (!newMark.examType) errors.examType = 'Exam type is required'
    if (!newMark.semester) errors.semester = 'Semester is required'
    if (newMark.marksObtained < 0 || newMark.marksObtained > newMark.totalMarks) {
      errors.marksObtained = `Marks should be between 0 and ${newMark.totalMarks}`
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    try {
      if (editingMark) {
        await updateMark(editingMark._id, newMark)
        setEditingMark(null)
      } else {
        await createMark(newMark)
      }

      setShowAddMark(false)
      setNewMark({
        studentID: '',
        subject: '',
        marksObtained: 0,
        totalMarks: 100,
        examType: 'Midterm',
        semester: '',
        date: new Date().toISOString().split('T')[0]
      })
      alert(`Mark ${editingMark ? 'updated' : 'added'} successfully!`)
    } catch (err: any) {
      setError(err.message || `Failed to ${editingMark ? 'update' : 'add'} mark`)
    }
  }

  const getGrade = (marks: number, total: number) => {
    const percentage = (marks / total) * 100
    if (percentage >= 90) return 'A+'
    if (percentage >= 80) return 'A'
    if (percentage >= 70) return 'B'
    if (percentage >= 60) return 'C'
    if (percentage >= 40) return 'D'
    return 'F'
  }

  const getFullName = (student: Student) => {
    return `${student.firstName}${student.lastName ? ` ${student.lastName}` : ''}`
  }

  const stats = getStatistics()

  // Add Mark Form Component
  const MarkForm = () => (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{editingMark ? 'Edit Mark' : 'Add New Mark'}</DialogTitle>
      </DialogHeader>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="studentID">Student *</Label>
            <Select
              value={newMark.studentID}
              onValueChange={(value) => setNewMark(prev => ({ ...prev, studentID: value }))}
            >
              <SelectTrigger className={formErrors.studentID ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student._id} value={student.studentID}>
                    {getFullName(student)} ({student.studentID})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formErrors.studentID && <p className="text-sm text-red-500 mt-1">{formErrors.studentID}</p>}
          </div>
          <div>
            <Label htmlFor="subject">Subject *</Label>
            <Select
              value={newMark.subject}
              onValueChange={(value) => setNewMark(prev => ({ ...prev, subject: value }))}
            >
              <SelectTrigger className={formErrors.subject ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formErrors.subject && <p className="text-sm text-red-500 mt-1">{formErrors.subject}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="marksObtained">Marks Obtained *</Label>
            <Input
              id="marksObtained"
              type="number"
              min="0"
              max={newMark.totalMarks}
              value={newMark.marksObtained}
              onChange={(e) => setNewMark(prev => ({ ...prev, marksObtained: parseInt(e.target.value) || 0 }))}
              className={formErrors.marksObtained ? 'border-red-500' : ''}
            />
            {formErrors.marksObtained && <p className="text-sm text-red-500 mt-1">{formErrors.marksObtained}</p>}
          </div>
          <div>
            <Label htmlFor="totalMarks">Total Marks *</Label>
            <Input
              id="totalMarks"
              type="number"
              min="1"
              value={newMark.totalMarks}
              onChange={(e) => setNewMark(prev => ({ ...prev, totalMarks: parseInt(e.target.value) || 100 }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="examType">Exam Type *</Label>
            <Select
              value={newMark.examType}
              onValueChange={(value: any) => setNewMark(prev => ({ ...prev, examType: value }))}
            >
              <SelectTrigger className={formErrors.examType ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select exam type" />
              </SelectTrigger>
              <SelectContent>
                {examTypes.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formErrors.examType && <p className="text-sm text-red-500 mt-1">{formErrors.examType}</p>}
          </div>
          <div>
            <Label htmlFor="semester">Semester *</Label>
            <Select
              value={newMark.semester}
              onValueChange={(value) => setNewMark(prev => ({ ...prev, semester: value }))}
            >
              <SelectTrigger className={formErrors.semester ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select semester" />
              </SelectTrigger>
              <SelectContent>
                {semesters.map((semester) => (
                  <SelectItem key={semester} value={semester}>{semester}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formErrors.semester && <p className="text-sm text-red-500 mt-1">{formErrors.semester}</p>}
          </div>
        </div>

        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={newMark.date.split('T')[0]}
            onChange={(e) => setNewMark(prev => ({ ...prev, date: e.target.value }))}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowAddMark(false)
              setEditingMark(null)
              setError(null)
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? 'Saving...' : (editingMark ? 'Update Mark' : 'Add Mark')}
          </Button>
        </div>
      </form>
    </DialogContent>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Marks Management</h2>
          <p className="text-muted-foreground">
            Manage student marks by class, subject, and exam type
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={showAddMark} onOpenChange={setShowAddMark}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Mark
              </Button>
            </DialogTrigger>
            <MarkForm />
          </Dialog>
          {hasChanges && (
            <Button onClick={saveAllChanges} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saving ? 'Saving...' : 'Save All Changes'}
            </Button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Selection Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Select Class and Exam Details</CardTitle>
          <CardDescription>
            Choose the class, subject, exam type, and semester for marks management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="grade">Grade</Label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger>
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
            </div>
            <div>
              <Label htmlFor="section">Section</Label>
              <Select value={selectedSection} onValueChange={setSelectedSection}>
                <SelectTrigger>
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section} value={section}>
                      Section {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="examType">Exam Type</Label>
              <Select value={selectedExamType} onValueChange={(value: any) => setSelectedExamType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select exam type" />
                </SelectTrigger>
                <SelectContent>
                  {examTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="semester">Semester</Label>
              <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                <SelectTrigger>
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  {semesters.map((semester) => (
                    <SelectItem key={semester} value={semester}>{semester}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {selectedGrade && selectedSubject && selectedExamType && selectedSemester && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendingUp className="mr-2 h-4 w-4" />
                Average
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {stats.average.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">Class average</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Award className="mr-2 h-4 w-4" />
                Highest
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.highest}
              </div>
              <p className="text-xs text-muted-foreground">Best score</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Lowest</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats.lowest}
              </div>
              <p className="text-xs text-muted-foreground">Needs improvement</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Passed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.passed}
              </div>
              <p className="text-xs text-muted-foreground">Students passed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.total}
              </div>
              <p className="text-xs text-muted-foreground">Students evaluated</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading data...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Marks Entry Table */}
      {!loading && selectedGrade && selectedSubject && selectedExamType && selectedSemester && students.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Marks Entry - {selectedSubject} ({selectedExamType})
            </CardTitle>
            <CardDescription>
              Grade {selectedGrade}{selectedSection ? `-${selectedSection}` : ''} • {selectedSemester}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Marks Obtained</TableHead>
                  <TableHead>Total Marks</TableHead>
                  <TableHead>Percentage</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => {
                  const mark = student.currentMark
                  const marksObtained = mark?.marksObtained || 0
                  const totalMarks = mark?.totalMarks || 100
                  const percentage = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0
                  const grade = getGrade(marksObtained, totalMarks)
                  const status = marksObtained >= 40 ? 'Pass' : 'Fail'

                  return (
                    <TableRow key={student._id}>
                      <TableCell>{student.studentID}</TableCell>
                      <TableCell className="font-medium">{getFullName(student)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={marksObtained}
                          onChange={(e) => handleMarksChange(student.studentID, e.target.value)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>{totalMarks}</TableCell>
                      <TableCell>{percentage.toFixed(1)}%</TableCell>
                      <TableCell>
                        <Badge variant={
                          grade === 'A+' || grade === 'A' ? 'default' :
                            grade === 'B' || grade === 'C' ? 'secondary' :
                              grade === 'D' ? 'outline' : 'destructive'
                        }>
                          {grade}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status === 'Pass' ? 'default' : 'destructive'}>
                          {mark ? status : 'Not Entered'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {mark && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingMark(mark)
                                  setNewMark({
                                    studentID: mark.studentID,
                                    subject: mark.subject,
                                    marksObtained: mark.marksObtained,
                                    totalMarks: mark.totalMarks,
                                    examType: mark.examType,
                                    semester: mark.semester,
                                    date: mark.date.split('T')[0]
                                  })
                                  setShowAddMark(true)
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this mark?')) {
                                    deleteMark(mark._id)
                                  }
                                }}
                                disabled={saving}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {!loading && (!selectedGrade || !selectedSubject || !selectedExamType || !selectedSemester) && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Select All Filters
              </h3>
              <p className="text-muted-foreground">
                Please select grade, subject, exam type, and semester to view and manage marks
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Students State */}
      {!loading && selectedGrade && students.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No Students Found
              </h3>
              <p className="text-muted-foreground">
                No students found for the selected grade and section
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
