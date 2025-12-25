import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Search, Save, Download, Calendar as CalendarIcon, Check, X, Users, UserCheck, UserX, Clock, Eye, Loader2, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
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
  isPresent: boolean | null // UI state for current attendance marking
}

interface AttendanceRecord {
  _id: string
  date: string
  studentID: string
  totalDays: number
  totalPresent: number
  status: 'Present' | 'Absent'
}

interface AttendanceStats {
  total: number
  present: number
  absent: number
  notMarked: number
  percentage: number
}

interface AttendanceHistoryItem {
  date: string
  grade: number
  section: string
  totalStudents: number
  presentStudents: number
  absentStudents: number
  percentage: number
}

export const Attendance: React.FC = () => {
  const [selectedGrade, setSelectedGrade] = useState<string>('')
  const [selectedSection, setSelectedSection] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [students, setStudents] = useState<Student[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceHistoryItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      // Initialize attendance state
      const studentsWithAttendance = filteredStudents.map((student: Student) => ({
        ...student,
        isPresent: null
      }))

      setStudents(studentsWithAttendance)
      setError(null)
    } catch (err) {
      console.error('Error fetching students:', err)
      setError('Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  const fetchAttendanceForDate = async () => {
    try {
      setLoading(true)
      const dateStr = format(selectedDate, 'yyyy-MM-dd')

      // Get current students from state
      setStudents(currentStudents => {
        if (currentStudents.length === 0) return currentStudents

        // Fetch attendance records for all students for the selected date
        const promises = currentStudents.map(async (student) => {
          try {
            const token = localStorage.getItem('teacherToken')
            const response = await fetch(`/api/teachers/Attendance/${student.studentID}`, {
              headers: {
                'Authorization': token ? `Bearer ${token}` : ''
              }
            })
            if (response.ok) {
              const records = await response.json()
              // Find record for selected date
              return records.find((record: AttendanceRecord) => record.date === dateStr)
            }
            return null
          } catch (err) {
            console.error(`Error fetching attendance for student ${student.studentID}:`, err)
            return null
          }
        })

        Promise.all(promises).then(attendanceData => {
          setAttendanceRecords(attendanceData.filter(Boolean))

          // Update students with their attendance status
          setStudents(prevStudents => prevStudents.map((student, index) => {
            const record = attendanceData[index]
            return {
              ...student,
              isPresent: record ? (record.status === 'Present' ? true : false) : null
            }
          }))
        }).catch(err => {
          console.error('Error fetching attendance:', err)
          setError('Failed to load attendance data')
        }).finally(() => {
          setLoading(false)
        })

        return currentStudents
      })
    } catch (err) {
      console.error('Error fetching attendance:', err)
      setError('Failed to load attendance data')
      setLoading(false)
    }
  }

  const fetchAttendanceHistory = async () => {
    try {
      const token = localStorage.getItem('teacherToken')
      const response = await fetch('/api/teachers/Attendance', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      })
      if (!response.ok) throw new Error('Failed to fetch attendance history')
      const data = await response.json()

      // Process data to create history summary
      const historyMap = new Map<string, any>()

      data.forEach((record: AttendanceRecord) => {
        const key = `${record.date}`
        if (!historyMap.has(key)) {
          historyMap.set(key, {
            date: record.date,
            totalStudents: 0,
            presentStudents: 0,
            absentStudents: 0
          })
        }

        const entry = historyMap.get(key)
        entry.totalStudents += 1
        if (record.status === 'Present') {
          entry.presentStudents += 1
        } else {
          entry.absentStudents += 1
        }
      })

      const historyArray = Array.from(historyMap.values()).map(entry => ({
        ...entry,
        percentage: entry.totalStudents > 0 ? (entry.presentStudents / entry.totalStudents) * 100 : 0
      }))

      setAttendanceHistory(historyArray.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
    } catch (err) {
      console.error('Error fetching attendance history:', err)
      setError('Failed to load attendance history')
    }
  }

  const markAttendance = async (studentID: string, status: 'Present' | 'Absent') => {
    try {
      const token = localStorage.getItem('teacherToken')
      const response = await fetch('/api/teachers/Attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          studentID,
          status
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to mark attendance')
      }

      return await response.json()
    } catch (err) {
      console.error('Error marking attendance:', err)
      throw err
    }
  }

  const updateAttendance = async (studentID: string, status: 'Present' | 'Absent') => {
    try {
      const token = localStorage.getItem('teacherToken')
      const response = await fetch(`/api/teachers/Attendance/${studentID}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          status
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update attendance')
      }

      return await response.json()
    } catch (err) {
      console.error('Error updating attendance:', err)
      throw err
    }
  }

  // Load students when grade/section changes
  useEffect(() => {
    if (selectedGrade) {
      fetchStudents()
    }
  }, [selectedGrade, selectedSection])

  // Load attendance when students or date changes
  useEffect(() => {
    if (students.length > 0) {
      fetchAttendanceForDate()
    }
  }, [students.length, selectedDate])

  // Load attendance history
  useEffect(() => {
    fetchAttendanceHistory()
  }, [])

  // Reset section when grade changes
  useEffect(() => {
    setSelectedSection('')
  }, [selectedGrade])

  const handleAttendanceChange = (studentId: string, status: boolean) => {
    setStudents(prev =>
      prev.map(student =>
        student.studentID === studentId
          ? { ...student, isPresent: status }
          : student
      )
    )
    setHasChanges(true)
  }

  const markAllPresent = () => {
    setStudents(prev => prev.map(student => ({ ...student, isPresent: true })))
    setHasChanges(true)
  }

  const markAllAbsent = () => {
    setStudents(prev => prev.map(student => ({ ...student, isPresent: false })))
    setHasChanges(true)
  }

  const clearAll = () => {
    setStudents(prev => prev.map(student => ({ ...student, isPresent: null })))
    setHasChanges(true)
  }

  const saveAttendance = async () => {
    if (!selectedGrade || students.length === 0) return

    setSaving(true)

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const today = format(new Date(), 'yyyy-MM-dd')

      // Only allow marking attendance for today
      if (dateStr !== today) {
        throw new Error('Attendance can only be marked for today')
      }

      const promises = students
        .filter(student => student.isPresent !== null)
        .map(async (student) => {
          const status = student.isPresent ? 'Present' : 'Absent'
          const existingRecord = attendanceRecords.find(r => r.studentID === student.studentID)

          if (existingRecord) {
            // Update existing record
            return await updateAttendance(student.studentID, status)
          } else {
            // Create new record
            return await markAttendance(student.studentID, status)
          }
        })

      await Promise.all(promises)

      setHasChanges(false)
      setError(null)

      // Refresh attendance data
      await fetchAttendanceForDate()
      await fetchAttendanceHistory()

      alert('Attendance saved successfully!')
    } catch (err: any) {
      console.error('Error saving attendance:', err)
      setError(err.message || 'Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  const filteredStudents = students.filter(student =>
    `${student.firstName} ${student.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.studentID.includes(searchTerm)
  )

  const getAttendanceStats = (): AttendanceStats => {
    const total = students.length
    const present = students.filter(s => s.isPresent === true).length
    const absent = students.filter(s => s.isPresent === false).length
    const notMarked = students.filter(s => s.isPresent === null).length
    const percentage = total > 0 ? (present / total) * 100 : 0

    return { total, present, absent, notMarked, percentage }
  }

  const getFullName = (student: Student) => {
    return `${student.firstName}${student.lastName ? ` ${student.lastName}` : ''}`
  }

  const stats = getAttendanceStats()

  const AttendanceHistoryDialog = () => (
    <Dialog open={showHistory} onOpenChange={setShowHistory}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Attendance History</DialogTitle>
          <DialogDescription>
            View past attendance records for all classes
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {attendanceHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Total Students</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead>Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceHistory.map((record, index) => (
                  <TableRow key={index}>
                    <TableCell>{format(new Date(record.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{record.totalStudents}</TableCell>
                    <TableCell className="text-green-600 dark:text-green-400">
                      {record.presentStudents}
                    </TableCell>
                    <TableCell className="text-red-600 dark:text-red-400">
                      {record.absentStudents}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          record.percentage >= 90 ? 'default' :
                            record.percentage >= 80 ? 'secondary' : 'destructive'
                        }
                      >
                        {record.percentage.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No attendance history available</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => setShowHistory(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Attendance Management</h2>
          <p className="text-muted-foreground">
            Mark student attendance for your classes
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setShowHistory(true)}>
            <Eye className="mr-2 h-4 w-4" />
            View History
          </Button>
          <Button variant="outline" disabled>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      {/* Class and Date Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Class and Date</CardTitle>
          <CardDescription>
            Choose the grade, section, and date for attendance marking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
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
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    disabled={(date) => date > new Date()} // Disable future dates
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {selectedGrade && students.length > 0 && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <p className="text-xs text-muted-foreground">In class</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Present</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.present}</div>
              <p className="text-xs text-muted-foreground">Students present</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Absent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.absent}</div>
              <p className="text-xs text-muted-foreground">Students absent</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Not Marked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.notMarked}</div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Percentage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.percentage.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Attendance rate</p>
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
              <p className="text-muted-foreground">Loading attendance data...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student List */}
      {!loading && selectedGrade && students.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Student Attendance</CardTitle>
                <CardDescription>
                  Mark attendance for Grade {selectedGrade}{selectedSection ? `-${selectedSection}` : ''} on {format(selectedDate, 'PPP')}
                </CardDescription>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={markAllPresent}>
                  <UserCheck className="mr-2 h-4 w-4" />
                  All Present
                </Button>
                <Button variant="outline" size="sm" onClick={markAllAbsent}>
                  <UserX className="mr-2 h-4 w-4" />
                  All Absent
                </Button>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Clear All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Search */}
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Student List */}
              <div className="grid gap-2">
                {filteredStudents.map((student) => (
                  <div
                    key={student._id}
                    className={cn(
                      "flex items-center justify-between p-3 border rounded-lg transition-colors",
                      student.isPresent === true && "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
                      student.isPresent === false && "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800",
                      student.isPresent === null && "bg-muted/50"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                        <Users className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{getFullName(student)}</div>
                        <div className="text-sm text-muted-foreground">
                          ID: {student.studentID}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant={student.isPresent === true ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleAttendanceChange(student.studentID, true)}
                        className={cn(
                          "h-8 w-8 p-0",
                          student.isPresent === true && "bg-green-600 hover:bg-green-700 text-white"
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={student.isPresent === false ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleAttendanceChange(student.studentID, false)}
                        className={cn(
                          "h-8 w-8 p-0",
                          student.isPresent === false && "bg-red-600 hover:bg-red-700 text-white"
                        )}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Save Button */}
              {hasChanges && (
                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button variant="outline" onClick={clearAll}>
                    Clear All
                  </Button>
                  <Button onClick={saveAttendance} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Attendance
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Grade Selected State */}
      {!loading && !selectedGrade && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Select Grade and Section</h3>
              <p className="text-muted-foreground">Please select a grade and section to start marking attendance</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Students Found State */}
      {!loading && selectedGrade && students.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Students Found</h3>
              <p className="text-muted-foreground">
                No students found for Grade {selectedGrade}{selectedSection ? `-${selectedSection}` : ''}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <AttendanceHistoryDialog />
    </div>
  )
}
