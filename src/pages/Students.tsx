import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, Users, UserCheck, UserX, TrendingUp, Calendar, Mail, Phone, MapPin, Eye, Loader2, AlertCircle } from 'lucide-react'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'

// Updated interfaces to match your backend schema
interface Student {
  _id: string
  studentID: string
  firstName: string
  lastName?: string
  fathersName: string
  mothersName: string
  Address: string
  grade: number
  section: string
  email: string
  sessionExpiry?: Date | null
  lastLoginAt?: Date
}

// Extended interface for displaying additional data
interface StudentWithStats extends Student {
  marks?: Mark[]
  attendance?: AttendanceData
  recentAttendance?: RecentAttendance[]
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

interface AttendanceRecord {
  _id: string
  date: string
  studentID: string
  totalDays: number
  totalPresent: number
  status: 'Present' | 'Absent'
}

interface AttendanceData {
  totalDays: number
  presentDays: number
  absentDays: number
  percentage: number
}

interface RecentAttendance {
  date: string
  status: 'present' | 'absent'
}

interface StudentStats {
  totalStudents: number
  activeStudents: number
  gradeDistribution: { [key: string]: number }
}

export const Students: React.FC = () => {
  const [students, setStudents] = useState<StudentWithStats[]>([])
  const [filteredStudents, setFilteredStudents] = useState<StudentWithStats[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGrade, setSelectedGrade] = useState<string>('all')
  const [selectedSection, setSelectedSection] = useState<string>('all')
  const [selectedStudent, setSelectedStudent] = useState<StudentWithStats | null>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use the teacher classes hook
  const {
    getAssignedGrades,
    getSectionsForGrade,
    loading: classesLoading
  } = useTeacherClasses()

  // Get dynamic grades and sections based on teacher's assignments
  const grades = getAssignedGrades()
  const sections = selectedGrade !== 'all'
    ? getSectionsForGrade(parseInt(selectedGrade))
    : []

  // API functions
  const fetchAllStudents = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all students from the backend
      const token = localStorage.getItem('teacherToken')
      const response = await fetch('/api/teachers/students', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', errorText)
        throw new Error('Failed to fetch students')
      }
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Non-JSON response received:', text.substring(0, 200))
        throw new Error('Server returned non-JSON response')
      }
      const allStudents: Student[] = await response.json()

      // Enhance student data with additional information
      const studentsWithStats = await Promise.all(
        allStudents.map(async (student) => {
          try {
            // Fetch marks and attendance data for each student
            const [marks, attendance] = await Promise.all([
              fetchStudentMarks(student.studentID),
              fetchStudentAttendance(student.studentID)
            ])

            return {
              ...student,
              marks,
              attendance: calculateAttendanceStats(attendance),
              recentAttendance: getRecentAttendance(attendance)
            }
          } catch (err) {
            console.error(`Failed to fetch additional data for student ${student.studentID}:`, err)
            return student
          }
        })
      )

      setStudents(studentsWithStats)
      setFilteredStudents(studentsWithStats)
    } catch (err) {
      console.error('Error fetching all students:', err)
      setError('Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  const fetchStudentMarks = async (studentID: string): Promise<Mark[]> => {
    try {
      const token = localStorage.getItem('teacherToken')
      const response = await fetch(`/api/teachers/Marks/${studentID}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      })
      if (!response.ok) return []
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        return []
      }
      const data = await response.json()

      // Flatten categorized marks
      const allMarks: Mark[] = []
      Object.values(data).forEach((categoryMarks: any) => {
        if (Array.isArray(categoryMarks)) {
          allMarks.push(...categoryMarks)
        }
      })

      return allMarks
    } catch (err) {
      console.error(`Error fetching marks for student ${studentID}:`, err)
      return []
    }
  }

  const fetchStudentAttendance = async (studentID: string): Promise<AttendanceRecord[]> => {
    try {
      const token = localStorage.getItem('teacherToken')
      const response = await fetch(`/api/teachers/Attendance/${studentID}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      })
      if (!response.ok) return []
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        return []
      }
      const data = await response.json()
      return data
    } catch (err) {
      console.error(`Error fetching attendance for student ${studentID}:`, err)
      return []
    }
  }

  const searchStudentsByName = async (name: string) => {
    try {
      setLoading(true)
      // Search is handled client-side - filter from already loaded students
      const searchTerm = name.toLowerCase()
      const filtered = students.filter(student => {
        const fullName = `${student.firstName} ${student.lastName || ''}`.toLowerCase()
        return fullName.includes(searchTerm) || student.studentID.toLowerCase().includes(searchTerm)
      })
      setFilteredStudents(filtered)
    } catch (err) {
      console.error('Error searching students:', err)
      setError('Failed to search students')
    } finally {
      setLoading(false)
    }
  }

  // Calculate attendance statistics
  const calculateAttendanceStats = (records: AttendanceRecord[]): AttendanceData => {
    if (!records.length) {
      return { totalDays: 0, presentDays: 0, absentDays: 0, percentage: 0 }
    }

    // Get the latest record for cumulative data
    const latestRecord = records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

    return {
      totalDays: latestRecord.totalDays,
      presentDays: latestRecord.totalPresent,
      absentDays: latestRecord.totalDays - latestRecord.totalPresent,
      percentage: latestRecord.totalDays > 0 ? (latestRecord.totalPresent / latestRecord.totalDays) * 100 : 0
    }
  }

  // Get recent attendance records
  const getRecentAttendance = (records: AttendanceRecord[]): RecentAttendance[] => {
    return records
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map(record => ({
        date: record.date,
        status: record.status === 'Present' ? 'present' : 'absent'
      }))
  }

  // Load data on component mount
  useEffect(() => {
    fetchAllStudents()
  }, [])

  // Handle search with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim()) {
        searchStudentsByName(searchTerm)
      } else {
        // Reset to show all students or apply other filters
        applyFilters()
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Apply grade and section filters
  const applyFilters = () => {
    let filtered = students

    // Filter by grade
    if (selectedGrade !== 'all') {
      filtered = filtered.filter(student => student.grade.toString() === selectedGrade)
    }

    // Filter by section
    if (selectedSection !== 'all') {
      filtered = filtered.filter(student => student.section === selectedSection)
    }

    setFilteredStudents(filtered)
  }

  useEffect(() => {
    if (!searchTerm.trim()) {
      applyFilters()
    }
  }, [selectedGrade, selectedSection, students])

  // Reset section when grade changes
  useEffect(() => {
    setSelectedSection('all')
  }, [selectedGrade])

  // Get full name
  const getFullName = (student: Student) => {
    return `${student.firstName}${student.lastName ? ` ${student.lastName}` : ''}`
  }

  // Get session status
  const getSessionStatus = (student: Student) => {
    if (!student.sessionExpiry) return 'Inactive'
    return new Date(student.sessionExpiry) > new Date() ? 'Active' : 'Expired'
  }

  // Calculate overall grade based on marks
  const calculateOverallGrade = (marks: Mark[] = []) => {
    if (!marks.length) return { grade: 'N/A', percentage: 0 }

    const totalObtained = marks.reduce((sum, mark) => sum + mark.marksObtained, 0)
    const totalMarks = marks.reduce((sum, mark) => sum + mark.totalMarks, 0)

    if (totalMarks === 0) return { grade: 'N/A', percentage: 0 }

    const percentage = (totalObtained / totalMarks) * 100

    let grade = 'F'
    if (percentage >= 90) grade = 'A+'
    else if (percentage >= 80) grade = 'A'
    else if (percentage >= 70) grade = 'B'
    else if (percentage >= 60) grade = 'C'
    else if (percentage >= 40) grade = 'D'

    return { grade, percentage }
  }

  const openProfile = (student: StudentWithStats) => {
    setSelectedStudent(student)
    setShowProfile(true)
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'A':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'B':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'C':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
      default:
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    }
  }

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 dark:text-green-400'
    if (percentage >= 75) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  // Calculate student statistics
  const getStudentStats = (): StudentStats => {
    const gradeDistribution: { [key: string]: number } = {}

    students.forEach(student => {
      const gradeKey = `Grade ${student.grade}`
      gradeDistribution[gradeKey] = (gradeDistribution[gradeKey] || 0) + 1
    })

    return {
      totalStudents: students.length,
      activeStudents: students.filter(student => getSessionStatus(student) === 'Active').length,
      gradeDistribution
    }
  }

  const StudentProfile = ({ student }: { student: StudentWithStats }) => {
    const { grade: overallGrade, percentage: overallPercentage } = calculateOverallGrade(student.marks)

    return (
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Student Profile</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6">
          {/* Basic Info */}
          <div className="flex items-start space-x-6">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="text-lg">
                {student.firstName[0]}{student.lastName?.[0] || ''}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-foreground">{getFullName(student)}</h2>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-sm text-muted-foreground">Student ID</p>
                  <p className="font-medium">{student.studentID}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Class</p>
                  <p className="font-medium">Grade {student.grade} - Section {student.section}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Session Status</p>
                  <Badge variant={getSessionStatus(student) === 'Active' ? 'default' : 'destructive'}>
                    {getSessionStatus(student)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Overall Percentage</p>
                  <p className="font-medium">{overallPercentage.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Phone className="mr-2 h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{student.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{student.Address}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Father's Name</p>
                  <p className="font-medium">{student.fathersName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Mother's Name</p>
                  <p className="font-medium">{student.mothersName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Login</p>
                  <p className="font-medium">
                    {student.lastLoginAt
                      ? new Date(student.lastLoginAt).toLocaleDateString()
                      : 'Never'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Academic Performance */}
          {student.marks && student.marks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5" />
                  Academic Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {student.marks.map((mark) => {
                    const percentage = (mark.marksObtained / mark.totalMarks) * 100
                    let grade = 'F'
                    if (percentage >= 90) grade = 'A+'
                    else if (percentage >= 80) grade = 'A'
                    else if (percentage >= 70) grade = 'B'
                    else if (percentage >= 60) grade = 'C'
                    else if (percentage >= 40) grade = 'D'

                    return (
                      <div key={mark._id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex-1">
                          <p className="font-medium">{mark.subject}</p>
                          <p className="text-sm text-muted-foreground">
                            {mark.marksObtained} / {mark.totalMarks} marks ({mark.examType})
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-right">
                            <p className="font-medium">{percentage.toFixed(1)}%</p>
                          </div>
                          <Badge className={getGradeColor(grade)}>
                            {grade}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attendance */}
          {student.attendance && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="mr-2 h-5 w-5" />
                  Attendance Record
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{student.attendance.totalDays}</p>
                    <p className="text-sm text-muted-foreground">Total Days</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {student.attendance.presentDays}
                    </p>
                    <p className="text-sm text-muted-foreground">Present</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {student.attendance.absentDays}
                    </p>
                    <p className="text-sm text-muted-foreground">Absent</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${getAttendanceColor(student.attendance.percentage)}`}>
                      {student.attendance.percentage.toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">Percentage</p>
                  </div>
                </div>

                {student.recentAttendance && student.recentAttendance.length > 0 && (
                  <div>
                    <p className="font-medium mb-2">Recent Attendance</p>
                    <div className="grid grid-cols-5 gap-2">
                      {student.recentAttendance.map((record, index) => (
                        <div key={index} className="text-center p-2 border rounded">
                          <p className="text-xs text-muted-foreground">
                            {new Date(record.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                          <Badge
                            variant={record.status === 'present' ? 'default' : 'destructive'}
                            className="mt-1"
                          >
                            {record.status === 'present' ? 'P' : 'A'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    )
  }

  const stats = getStudentStats()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Students</h2>
          <p className="text-muted-foreground">
            View and manage student information, marks, and attendance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="px-3 py-1">
            {filteredStudents.length} students
          </Badge>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalStudents}</div>
            <p className="text-xs text-muted-foreground">Across all grades</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.activeStudents}</div>
            <p className="text-xs text-muted-foreground">Currently active sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Filtered Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{filteredStudents.length}</div>
            <p className="text-xs text-muted-foreground">Matching current filters</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Students</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {grades.map((grade) => (
                  <SelectItem key={grade} value={grade.toString()}>
                    Grade {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedSection} onValueChange={setSelectedSection}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {sections.map((section) => (
                  <SelectItem key={section} value={section}>
                    Section {section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading students...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Students Grid */}
      {!loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student) => {
            const { grade: overallGrade } = calculateOverallGrade(student.marks)
            const attendancePercentage = student.attendance?.percentage || 0

            return (
              <Card key={student._id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {student.firstName[0]}{student.lastName?.[0] || ''}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{getFullName(student)}</h3>
                      <p className="text-sm text-muted-foreground">ID: {student.studentID}</p>
                      <p className="text-sm text-muted-foreground">Grade {student.grade}-{student.section}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Attendance</p>
                      <p className={`font-medium ${getAttendanceColor(attendancePercentage)}`}>
                        {attendancePercentage.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Overall Grade</p>
                      <Badge className={getGradeColor(overallGrade)}>
                        {overallGrade}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <Badge variant="outline">
                      {getSessionStatus(student)}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openProfile(student)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* No students found */}
      {!loading && filteredStudents.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Students Found</h3>
              <p className="text-muted-foreground">
                {searchTerm
                  ? `No students found matching "${searchTerm}"`
                  : 'Try adjusting your search criteria or filters'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student Profile Dialog */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        {selectedStudent && <StudentProfile student={selectedStudent} />}
      </Dialog>
    </div>
  )
}
