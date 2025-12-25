import { useState, useEffect } from 'react'

export interface TeacherClass {
    grade: number
    section: string
}

export const useTeacherClasses = () => {
    const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchTeacherClasses()
    }, [])

    const fetchTeacherClasses = async () => {
        try {
            setLoading(true)
            const token = localStorage.getItem('teacherToken')
            const response = await fetch('/api/teachers/profile', {
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            })

            if (!response.ok) {
                throw new Error('Failed to fetch teacher profile')
            }

            const data = await response.json()

            // Extract assigned classes from teacher profile
            // The backend should return classes in the format: { classes: [{ grade: 10, section: 'A' }, ...] }
            // If not available, we'll extract from students
            if (data.teacher?.classes && Array.isArray(data.teacher.classes)) {
                setTeacherClasses(data.teacher.classes)
            } else {
                // Fallback: fetch all students and extract unique grade-section combinations
                await fetchClassesFromStudents()
            }

            setError(null)
        } catch (err) {
            console.error('Error fetching teacher classes:', err)
            setError('Failed to load assigned classes')
            // Fallback to fetching from students
            await fetchClassesFromStudents()
        } finally {
            setLoading(false)
        }
    }

    const fetchClassesFromStudents = async () => {
        try {
            const token = localStorage.getItem('teacherToken')
            const response = await fetch('/api/teachers/students', {
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            })

            if (!response.ok) {
                throw new Error('Failed to fetch students')
            }

            const students = await response.json()

            // Extract unique grade-section combinations
            const uniqueClasses = new Map<string, TeacherClass>()
            students.forEach((student: any) => {
                const key = `${student.grade}-${student.section}`
                if (!uniqueClasses.has(key)) {
                    uniqueClasses.set(key, {
                        grade: student.grade,
                        section: student.section
                    })
                }
            })

            setTeacherClasses(Array.from(uniqueClasses.values()))
        } catch (err) {
            console.error('Error fetching classes from students:', err)
            // If this also fails, we'll have an empty array
        }
    }

    // Get unique grades assigned to teacher
    const getAssignedGrades = (): number[] => {
        const grades = [...new Set(teacherClasses.map(c => c.grade))]
        return grades.sort((a, b) => a - b)
    }

    // Get sections for a specific grade
    const getSectionsForGrade = (grade: number): string[] => {
        const sections = teacherClasses
            .filter(c => c.grade === grade)
            .map(c => c.section)
        return [...new Set(sections)].sort()
    }

    // Check if teacher is assigned to a specific class
    const isAssignedToClass = (grade: number, section: string): boolean => {
        return teacherClasses.some(c => c.grade === grade && c.section === section)
    }

    return {
        teacherClasses,
        loading,
        error,
        getAssignedGrades,
        getSectionsForGrade,
        isAssignedToClass,
        refetch: fetchTeacherClasses
    }
}
