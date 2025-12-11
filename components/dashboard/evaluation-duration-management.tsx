"use client"

/*
 * EVALUATION DURATION MANAGEMENT - Ito ang page para sa pag-set ng evaluation deadline at time
 * 
 * SIMPLE EXPLANATION:
 * 1. Dito mo i-set ang start date at end date ng evaluation period
 * 2. Makikita mo ang current evaluation period status
 * 3. Pwede kang mag-update ng deadline anytime
 */

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock } from "lucide-react"
import { evaluationDeadlineService } from "@/lib/database"
import type { EvaluationDeadline } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

// Interface for date/time fields
interface DateTimeFields {
  date: string // YYYY-MM-DD format
  time: string // HH:mm format
}

export function EvaluationDurationManagement() {
  const { toast } = useToast()

  // Deadline state variables
  const [isDeadlineDialogOpen, setIsDeadlineDialogOpen] = useState(false)
  const [activeDeadline, setActiveDeadline] = useState<EvaluationDeadline | null>(null)
  const [startDateTime, setStartDateTime] = useState<DateTimeFields>({
    date: "",
    time: "",
  })
  const [endDateTime, setEndDateTime] = useState<DateTimeFields>({
    date: "",
    time: "",
  })
  const [isLoadingDeadline, setIsLoadingDeadline] = useState(false)

  // Helper function to convert Date to DateTimeFields
  const dateToFields = (date: Date): DateTimeFields => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')

    return {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`,
    }
  }

  // Helper function to convert DateTimeFields to Date
  const fieldsToDate = (fields: DateTimeFields): Date | null => {
    if (!fields.date || !fields.time) {
      return null
    }

    // Parse date (YYYY-MM-DD)
    const [year, month, day] = fields.date.split('-').map(Number)

    // Parse time (HH:mm)
    const [hour, minute] = fields.time.split(':').map(Number)

    if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) {
      return null
    }

    // Validate month (1-12)
    if (month < 1 || month > 12) return null
    // Validate day (1-31, basic check)
    if (day < 1 || day > 31) return null
    // Validate hour (0-23)
    if (hour < 0 || hour > 23) return null
    // Validate minute (0-59)
    if (minute < 0 || minute > 59) return null

    return new Date(year, month - 1, day, hour, minute, 0, 0)
  }

  // Load active deadline on component mount and check status periodically
  useEffect(() => {
    const loadDeadline = async () => {
      try {
        const deadline = await evaluationDeadlineService.getActive()
        setActiveDeadline(deadline)
        if (deadline) {
          const startDate = new Date(deadline.startDate)
          const endDate = new Date(deadline.endDate)
          setStartDateTime(dateToFields(startDate))
          setEndDateTime(dateToFields(endDate))
        } else {
          // If no deadline exists, set current date/time as default
          const now = new Date()
          const defaultEndDate = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
          setStartDateTime(dateToFields(now))
          setEndDateTime(dateToFields(defaultEndDate))
        }
      } catch (error) {
        console.error("Error loading deadline:", error)
        // Set current date/time as default on error
        const now = new Date()
        const defaultEndDate = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
        setStartDateTime(dateToFields(now))
        setEndDateTime(dateToFields(defaultEndDate))
      }
    }
    loadDeadline()

    // Check deadline status every 30 seconds to update automatically
    const interval = setInterval(() => {
      loadDeadline()
    }, 30000) // Check every 30 seconds for real-time updates

    return () => clearInterval(interval)
  }, [])

  // Reset to current time when dialog opens - always set start date to current time
  const handleOpenDeadlineDialog = () => {
    // Always set start date to current date/time from computer
    const now = new Date()

    if (activeDeadline) {
      // If deadline exists, keep the existing end date but update start to current time
      const endDate = new Date(activeDeadline.endDate)
      setStartDateTime(dateToFields(now))
      setEndDateTime(dateToFields(endDate))
    } else {
      // If no deadline, set current date/time as start and 1 hour from now as end
      const defaultEndDate = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
      setStartDateTime(dateToFields(now))
      setEndDateTime(dateToFields(defaultEndDate))
    }

    setIsDeadlineDialogOpen(true)
  }

  // Update date/time inputs when dialog opens - always set start to current time
  useEffect(() => {
    if (isDeadlineDialogOpen) {
      // Always set start date to current date/time from computer
      const now = new Date()

      if (activeDeadline) {
        // If deadline exists, keep the existing end date but update start to current time
        const endDate = new Date(activeDeadline.endDate)
        setStartDateTime(dateToFields(now))
        setEndDateTime(dateToFields(endDate))
      } else {
        // If no deadline exists, set current date/time as start and 1 hour from now as end
        const defaultEndDate = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
        setStartDateTime(dateToFields(now))
        setEndDateTime(dateToFields(defaultEndDate))
      }
    }
  }, [isDeadlineDialogOpen, activeDeadline])

  // Automatically update end date & time to be 1 hour ahead of start date & time when user changes start
  useEffect(() => {
    // Only auto-update if dialog is open and both date and time are set
    // Skip on initial mount to avoid conflicts with initial load
    if (isDeadlineDialogOpen && startDateTime.date && startDateTime.time) {
      const startDate = fieldsToDate(startDateTime)
      if (startDate) {
        // Add 1 hour to start date
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000) // 1 hour = 60 minutes * 60 seconds * 1000 milliseconds
        const newEndDateTime = dateToFields(endDate)
        // Only update if it's different to avoid infinite loops
        if (newEndDateTime.date !== endDateTime.date || newEndDateTime.time !== endDateTime.time) {
          setEndDateTime(newEndDateTime)
        }
      }
    }
  }, [startDateTime.date, startDateTime.time, isDeadlineDialogOpen])

  // Function to get deadline status
  const getDeadlineStatus = () => {
    if (!activeDeadline) return null

    const now = new Date()
    const startDate = new Date(activeDeadline.startDate)
    const endDate = new Date(activeDeadline.endDate)

    if (now < startDate) {
      return { status: "not_started", label: "Not Started", color: "secondary" }
    } else if (now > endDate) {
      return { status: "ended", label: "Ended", color: "destructive" }
    } else {
      return { status: "open", label: "Open", color: "default" }
    }
  }

  // Handle deadline save - saves exactly what user inputs
  const handleSaveDeadline = async () => {
    // Validate all fields are filled
    if (!startDateTime.date || !startDateTime.time || !endDateTime.date || !endDateTime.time) {
      toast({
        title: "Validation Error",
        description: "Please fill in both date and time for start and end.",
        variant: "destructive",
      })
      return
    }

    // Convert fields to Date objects
    const startDate = fieldsToDate(startDateTime)
    const endDate = fieldsToDate(endDateTime)

    if (!startDate || !endDate) {
      toast({
        title: "Invalid Date",
        description: "Please enter valid date and time values.",
        variant: "destructive",
      })
      return
    }

    const now = new Date()

    if (startDate >= endDate) {
      toast({
        title: "Validation Error",
        description: "End date must be after start date.",
        variant: "destructive",
      })
      return
    }

    // Check if trying to update an expired deadline
    if (activeDeadline) {
      const currentEndDate = new Date(activeDeadline.endDate)
      // If current deadline has passed and new end date is also in the past, show warning
      if (now > currentEndDate && now > endDate) {
        toast({
          title: "Cannot Update Expired Deadline",
          description: "The deadline has already passed. Please set a new deadline with a future end date.",
          variant: "destructive",
        })
        return
      }
    }

    try {
      setIsLoadingDeadline(true)

      // Log the exact values being saved for debugging
      console.log("Saving deadline with exact values:", {
        startDateTime,
        endDateTime,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        startDateLocal: startDate.toLocaleString(),
        endDateLocal: endDate.toLocaleString(),
      })

      // Always update the single document (create if doesn't exist)
      // This will save the exact date/time values to the database
      await evaluationDeadlineService.create(startDate, endDate, true)

      toast({
        title: activeDeadline ? "Deadline Updated" : "Deadline Set",
        description: `Evaluation period saved: ${startDate.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })} - ${endDate.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })}`,
      })

      // Reload deadline to verify it was saved correctly
      console.log("🔄 Reloading deadline after save...")

      // Wait a moment for Firestore to propagate the write
      await new Promise(resolve => setTimeout(resolve, 500))

      // Try to get the active deadline first
      let deadline = await evaluationDeadlineService.getActive()

      // If getActive returns null, try getAll() as fallback (in case isActive check fails)
      if (!deadline) {
        console.log("🔄 getActive() returned null, trying getAll() as fallback...")
        const allDeadlines = await evaluationDeadlineService.getAll()
        if (allDeadlines.length > 0) {
          deadline = allDeadlines[0]
          console.log("✅ Found deadline via getAll() fallback")
        }
      }

      if (deadline) {
        setActiveDeadline(deadline)
        console.log("✅ Deadline reloaded successfully:", {
          id: deadline.id,
          startDate: deadline.startDate.toISOString(),
          endDate: deadline.endDate.toISOString(),
          isActive: deadline.isActive,
        })
      } else {
        console.warn("⚠️ Deadline was saved but could not be reloaded immediately.")
        console.warn("⚠️ This might be a timing issue. Trying again in 1 second...")

        // Retry after a delay
        setTimeout(async () => {
          try {
            const refreshedDeadline = await evaluationDeadlineService.getActive()
            if (!refreshedDeadline) {
              const allDeadlines = await evaluationDeadlineService.getAll()
              if (allDeadlines.length > 0) {
                setActiveDeadline(allDeadlines[0])
              }
            } else {
              setActiveDeadline(refreshedDeadline)
            }
          } catch (retryError) {
            console.error("Error reloading deadline on retry:", retryError)
          }
        }, 1000)
      }

      setIsDeadlineDialogOpen(false)
    } catch (error) {
      console.error("Error saving deadline:", error)
      const errorMessage = (error as any)?.message || "Unknown error occurred"
      toast({
        title: "Error Saving Deadline",
        description: `Failed to save deadline: ${errorMessage}. Please check the console for details.`,
        variant: "destructive",
      })
    } finally {
      setIsLoadingDeadline(false)
    }
  }

  const deadlineStatus = getDeadlineStatus()

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <div>
        <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-foreground">Duration of Evaluation</h2>
        <p className="text-xs sm:text-sm md:text-base text-muted-foreground">Set the evaluation period and deadline for student submissions</p>
      </div>

      {/* Deadline Banner */}
      {activeDeadline ? (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-blue-500/5">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1">
                <div className="p-2 sm:p-3 rounded-lg bg-primary/10 flex-shrink-0">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base text-foreground">Evaluation Period</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground break-words">
                    Start: {new Date(activeDeadline.startDate).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground break-words">
                    End: {new Date(activeDeadline.endDate).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  {deadlineStatus && (
                    <>
                      {deadlineStatus.status === "ended" && (
                        <Badge variant="destructive" className="mt-1.5 sm:mt-2 text-xs">Ended</Badge>
                      )}
                      {deadlineStatus.status === "not_started" && (
                        <Badge variant="secondary" className="mt-1.5 sm:mt-2 text-xs">Not Started</Badge>
                      )}
                      {deadlineStatus.status === "open" && (
                        <Badge variant="default" className="mt-1.5 sm:mt-2 bg-green-500 text-xs">Open</Badge>
                      )}
                    </>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleOpenDeadlineDialog}
                className="w-full sm:w-auto text-sm"
              >
                Update Deadline
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-center px-4">
              <Clock className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-1.5 sm:mb-2">No Evaluation Period Set</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 max-w-md">
                Set the start and end date for the evaluation period to allow students to submit evaluations.
              </p>
              <Button
                onClick={handleOpenDeadlineDialog}
                className="text-sm"
              >
                Set Evaluation Deadline
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deadline Setting Dialog */}
      <Dialog open={isDeadlineDialogOpen} onOpenChange={setIsDeadlineDialogOpen}>
        <DialogContent className="sm:max-w-[500px] w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-center sm:text-left">
            <DialogTitle className="text-lg sm:text-xl">
              Set Evaluation Deadline
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Set the start and end date for the evaluation period. Students can only submit evaluations during this time.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:gap-6 py-3 sm:py-4">
            {/* Start Date & Time */}
            <div className="grid gap-3 sm:gap-4">
              <div>
                <Label className="text-sm sm:text-base font-semibold">Start Date & Time</Label>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                  When students can start submitting evaluations
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* Date */}
                <div className="grid gap-1.5 sm:gap-2">
                  <Label htmlFor="start-date" className="text-xs sm:text-sm">Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDateTime.date}
                    onChange={(e) => setStartDateTime({ ...startDateTime, date: e.target.value })}
                    className="text-sm [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden h-8 px-2"
                  />
                </div>
                {/* Time */}
                <div className="grid gap-1.5 sm:gap-2">
                  <Label htmlFor="start-time" className="text-xs sm:text-sm">Time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={startDateTime.time}
                    onChange={(e) => setStartDateTime({ ...startDateTime, time: e.target.value })}
                    className="text-sm [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden h-8 px-2"
                  />
                </div>
              </div>
            </div>

            {/* End Date & Time */}
            <div className="grid gap-3 sm:gap-4">
              <div>
                <Label className="text-sm sm:text-base font-semibold">End Date & Time (Deadline)</Label>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                  Last date and time students can submit evaluations
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* Date */}
                <div className="grid gap-1.5 sm:gap-2">
                  <Label htmlFor="end-date" className="text-xs sm:text-sm">Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDateTime.date}
                    onChange={(e) => setEndDateTime({ ...endDateTime, date: e.target.value })}
                    className="text-sm [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden h-8 px-2"
                  />
                </div>
                {/* Time */}
                <div className="grid gap-1.5 sm:gap-2">
                  <Label htmlFor="end-time" className="text-xs sm:text-sm">Time</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={endDateTime.time}
                    onChange={(e) => setEndDateTime({ ...endDateTime, time: e.target.value })}
                    className="text-sm [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden h-8 px-2"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsDeadlineDialogOpen(false)}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveDeadline}
              disabled={
                isLoadingDeadline ||
                !startDateTime.date || !startDateTime.time ||
                !endDateTime.date || !endDateTime.time
              }
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              {isLoadingDeadline ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Setting...
                </>
              ) : (
                <span>Set</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

