import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Plus, Calendar as CalendarIcon, Users, Edit, Trash2, Save, X, Loader2, AlertCircle, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'
import { AssignmentForm } from '@/components/assignments/AssignmentForm'

// Updated interfaces to work with classes instead of individual students
interface Homework {
  _id: string
  grade: number
  section: string
  title: string
  description: string
  assignDate: string
  dueDate: string
  date: string
  createdAt?: string
  updatedAt?: string
}

interface NewHomework {
  grade: number
  section: string
  title: string
  description: string
  assignDate: string
  dueDate: string
  date: string
}

interface AssignmentStats {
  totalAssignments: number
  todayAssignments: number
  pendingAssignments: number
  completedAssignments: number
}

export const Assignments: React.FC = () => {
  const [assignments, setAssignments] = useState<Homework[]>([])
  const [filteredAssignments, setFilteredAssignments] = useState<Homework[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<Homework | null>(null)
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter states
  const [selectedGrade, setSelectedGrade] = useState<string>('')
  const [selectedSection, setSelectedSection] = useState<string>('')
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined)
  const [toDate, setToDate] = useState<Date | undefined>(undefined)
  const [searchTerm, setSearchTerm] = useState('')

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

  // Form state
  const [newHomework, setNewHomework] = useState<NewHomework>({
    grade: 0,
    section: '',
    title: '',
    description: '',
    assignDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    date: new Date().toISOString().split('T')[0]
  })

  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NewHomework, string>>>({})

  // API functions
  const fetchAllHomework = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('teacherToken')
      const response = await fetch('/api/teachers/Homework', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      })
      if (!response.ok) throw new Error('Failed to fetch homework')
      const data = await response.json()
      setAssignments(data)
      setFilteredAssignments(data)
      setError(null)
    } catch (err) {
      console.error('Error fetching homework:', err)
      setError('Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }

  const fetchHomeworkByRange = async () => {
    if (!fromDate || !toDate) return

    try {
      setLoading(true)
      const token = localStorage.getItem('teacherToken')
      const response = await fetch('/api/teachers/Homework/range', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          fromDate: format(fromDate, 'yyyy-MM-dd'),
          toDate: format(toDate, 'yyyy-MM-dd')
        })
      })

      if (!response.ok) throw new Error('Failed to fetch homework by range')
      const data = await response.json()
      setFilteredAssignments(data)
      setError(null)
    } catch (err) {
      console.error('Error fetching homework by range:', err)
      setError('Failed to load assignments for selected date range')
    } finally {
      setLoading(false)
    }
  }

  const createHomework = async (homeworkData: NewHomework) => {
    try {
      setSaving(true)
      const token = localStorage.getItem('teacherToken')
      const response = await fetch('/api/teachers/Homework', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(homeworkData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create homework')
      }

      await fetchAllHomework() // Refresh assignments
      return await response.json()
    } catch (err) {
      console.error('Error creating homework:', err)
      throw err
    } finally {
      setSaving(false)
    }
  }

  const updateHomework = async (homeworkID: string, homeworkData: Partial<NewHomework>) => {
    try {
      setSaving(true)
      const token = localStorage.getItem('teacherToken')
      const response = await fetch('/api/teachers/Homework', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ homeworkID, ...homeworkData })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update homework')
      }

      await fetchAllHomework() // Refresh assignments
      return await response.json()
    } catch (err) {
      console.error('Error updating homework:', err)
      throw err
    } finally {
      setSaving(false)
    }
  }

  const deleteHomework = async (homeworkID: string) => {
    try {
      setSaving(true)
      console.log('Deleting homework with ID:', homeworkID)

      const token = localStorage.getItem('teacherToken')
      const requestBody = { homeworkID }
      console.log('Delete request body:', requestBody)

      const response = await fetch('/api/teachers/Homework', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(requestBody)
      })

      console.log('Delete response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Delete error response:', errorData)
        throw new Error(errorData.message || 'Failed to delete homework')
      }

      const result = await response.json()
      console.log('Delete successful:', result)

      await fetchAllHomework() // Refresh assignments
    } catch (err) {
      console.error('Error deleting homework:', err)
      throw err
    } finally {
      setSaving(false)
    }
  }

  // Load data on component mount
  useEffect(() => {
    fetchAllHomework()
  }, [])

  // Reset section when grade changes
  useEffect(() => {
    setSelectedSection('')
  }, [selectedGrade])

  // Apply filters
  useEffect(() => {
    if (fromDate && toDate) {
      fetchHomeworkByRange()
    } else {
      let filtered = assignments

      // Filter by search term
      if (searchTerm) {
        filtered = filtered.filter(assignment =>
          assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          assignment.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      // Filter by grade
      if (selectedGrade) {
        filtered = filtered.filter(assignment => assignment.grade.toString() === selectedGrade)
      }

      // Filter by section
      if (selectedSection) {
        filtered = filtered.filter(assignment => assignment.section === selectedSection)
      }

      setFilteredAssignments(filtered)
    }
  }, [searchTerm, selectedGrade, selectedSection, assignments, fromDate, toDate])

  // Get class name
  const getClassName = (grade: number, section: string) => {
    return `Grade ${grade} - Section ${section}`
  }

  // Get assignment status based on due date
  const getAssignmentStatus = (dueDate: string) => {
    const today = new Date()
    const due = new Date(dueDate)

    if (due < today) return 'overdue'
    if (due.toDateString() === today.toDateString()) return 'due-today'
    return 'active'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'due-today':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  // Calculate statistics
  const getAssignmentStats = (): AssignmentStats => {
    const today = new Date().toISOString().split('T')[0]

    return {
      totalAssignments: assignments.length,
      todayAssignments: assignments.filter(a => a.date === today).length,
      pendingAssignments: assignments.filter(a => getAssignmentStatus(a.dueDate) === 'active').length,
      completedAssignments: assignments.filter(a => getAssignmentStatus(a.dueDate) === 'overdue').length
    }
  }

  // Form validation
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof NewHomework, string>> = {}

    if (!newHomework.grade || newHomework.grade === 0) errors.grade = 'Grade is required'
    if (!newHomework.section) errors.section = 'Section is required'
    if (!newHomework.title.trim()) errors.title = 'Title is required'
    if (!newHomework.description.trim()) errors.description = 'Description is required'
    if (!newHomework.assignDate) errors.assignDate = 'Assign date is required'
    if (!newHomework.dueDate) errors.dueDate = 'Due date is required'

    // Validate that due date is after assign date
    if (newHomework.assignDate && newHomework.dueDate) {
      if (new Date(newHomework.dueDate) <= new Date(newHomework.assignDate)) {
        errors.dueDate = 'Due date must be after assign date'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    try {
      if (editingAssignment) {
        await updateHomework(editingAssignment._id, newHomework)
        setEditingAssignment(null)
      } else {
        await createHomework(newHomework)
      }

      setShowForm(false)
      setNewHomework({
        grade: 0,
        section: '',
        title: '',
        description: '',
        assignDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        date: new Date().toISOString().split('T')[0]
      })
      alert(`Assignment ${editingAssignment ? 'updated' : 'created'} successfully!`)
    } catch (err: any) {
      setError(err.message || `Failed to ${editingAssignment ? 'update' : 'create'} assignment`)
    }
  }

  // Handle input changes
  const handleInputChange = useCallback((field: keyof NewHomework, value: string | number) => {
    setNewHomework(prev => ({
      ...prev,
      [field]: value
    }))

    // Clear error for this field
    setFormErrors(prev => {
      if (prev[field]) {
        return {
          ...prev,
          [field]: undefined
        }
      }
      return prev
    })
  }, [])

  // Handle edit
  const handleEdit = (assignment: Homework) => {
    setEditingAssignment(assignment)
    setNewHomework({
      grade: assignment.grade,
      section: assignment.section,
      title: assignment.title,
      description: assignment.description,
      assignDate: assignment.assignDate.split('T')[0],
      dueDate: assignment.dueDate.split('T')[0],
      date: assignment.date.split('T')[0]
    })
    setShowForm(true)
  }

  // Handle delete
  const handleDelete = async (homeworkID: string) => {
    console.log('Attempting to delete assignment with ID:', homeworkID)

    if (confirm('Are you sure you want to delete this assignment?')) {
      try {
        await deleteHomework(homeworkID)
        alert('Assignment deleted successfully!')
      } catch (err: any) {
        console.error('Delete error:', err)
        const errorMessage = err.message || 'Failed to delete assignment'
        setError(errorMessage)
        alert(`Error: ${errorMessage}`)
      }
    }
  }

  // Clear date filter
  const clearDateFilter = () => {
    setFromDate(undefined)
    setToDate(undefined)
    setFilteredAssignments(assignments)
  }

  const stats = getAssignmentStats()


  return (
    <div className="w-full max-w-none space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Assignments</h2>
          <p className="text-muted-foreground">
            Manage and track homework assignments for your classes
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={showDateFilter} onOpenChange={setShowDateFilter}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Date Filter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Filter by Date Range</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>From Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fromDate ? format(fromDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>To Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {toDate ? format(toDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={clearDateFilter}>Clear</Button>
                <Button onClick={() => setShowDateFilter(false)}>Apply</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingAssignment(null)
                setNewHomework({
                  grade: 0,
                  section: '',
                  title: '',
                  description: '',
                  assignDate: new Date().toISOString().split('T')[0],
                  dueDate: '',
                  date: new Date().toISOString().split('T')[0]
                })
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Create Assignment
              </Button>
            </DialogTrigger>
            <AssignmentForm
              newHomework={newHomework}
              formErrors={formErrors}
              error={error}
              saving={saving}
              editingAssignment={editingAssignment}
              grades={grades}
              getSectionsForGrade={getSectionsForGrade}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false)
                setEditingAssignment(null)
                setError(null)
              }}
            />
          </Dialog>
        </div>
      </div>

      {/* Error Display */}
      {error && !showForm && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalAssignments}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Today's Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.todayAssignments}</div>
            <p className="text-xs text-muted-foreground">Created today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.pendingAssignments}</div>
            <p className="text-xs text-muted-foreground">Not yet due</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.completedAssignments}</div>
            <p className="text-xs text-muted-foreground">Past due date</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="search">Search Assignments</Label>
              <Input
                id="search"
                placeholder="Search by title or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="grade">Filter by Grade</Label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="All grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Grades</SelectItem>
                  {grades.map((grade) => (
                    <SelectItem key={grade} value={grade.toString()}>
                      Grade {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="section">Filter by Section</Label>
              <Select value={selectedSection} onValueChange={setSelectedSection} disabled={!selectedGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Sections</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section} value={section}>
                      Section {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading assignments...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignments Grid */}
      {!loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 w-full">
          {filteredAssignments.map((assignment) => {
            const status = getAssignmentStatus(assignment.dueDate)
            return (
              <Card key={assignment._id} className="hover:shadow-lg transition-shadow w-full">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{assignment.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {assignment.description}
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(status)}>
                      {status === 'due-today' ? 'Due Today' : status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm">
                      <span className="font-medium">Class:</span> {getClassName(assignment.grade, assignment.section)}
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <CalendarIcon className="mr-1 h-4 w-4" />
                        Assigned: {format(new Date(assignment.assignDate), 'MMM dd, yyyy')}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <CalendarIcon className="mr-1 h-4 w-4" />
                        Due: {format(new Date(assignment.dueDate), 'MMM dd, yyyy')}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleEdit(assignment)}
                      >
                        <Edit className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDelete(assignment._id)}
                        disabled={saving}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* No Assignments State */}
      {!loading && filteredAssignments.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Assignments Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || selectedGrade || selectedSection || (fromDate && toDate)
                  ? 'Try adjusting your filters'
                  : 'Create your first assignment to get started'
                }
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Assignment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
