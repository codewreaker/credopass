"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon, Clock } from "lucide-react"
import { type DateRange } from "react-day-picker"

import { cn } from "../lib/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Input } from "./input"
import { Separator } from "./separator"

interface DateTimeRangePickerProps {
  value?: {
    from?: Date
    to?: Date
  }
  onChange?: (range: { from?: Date; to?: Date } | undefined) => void
  className?: string
  id?: string
  disabled?: boolean
}

function DateTimeRangePicker({
  value,
  onChange,
  className,
  id,
  disabled = false,
}: DateTimeRangePickerProps) {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(
    value ? { from: value.from, to: value.to } : undefined
  )
  const [startTime, setStartTime] = React.useState(
    value?.from ? format(value.from, "HH:mm") : "09:00"
  )
  const [endTime, setEndTime] = React.useState(
    value?.to ? format(value.to, "HH:mm") : "17:00"
  )

  // Sync external value changes
  React.useEffect(() => {
    if (value) {
      setDateRange({ from: value.from, to: value.to })
      if (value.from) setStartTime(format(value.from, "HH:mm"))
      if (value.to) setEndTime(format(value.to, "HH:mm"))
    }
  }, [value])

  // Combine date and time
  const combineDateTime = React.useCallback(
    (date: Date | undefined, time: string): Date | undefined => {
      if (!date) return undefined
      const [hours, minutes] = time.split(":").map(Number)
      const combined = new Date(date)
      combined.setHours(hours, minutes, 0, 0)
      return combined
    },
    []
  )

  // Update parent when date or time changes
  const updateParent = React.useCallback(
    (range: DateRange | undefined, start: string, end: string) => {
      if (!onChange) return
      if (!range?.from) {
        onChange(undefined)
        return
      }
      onChange({
        from: combineDateTime(range.from, start),
        to: combineDateTime(range.to || range.from, end),
      })
    },
    [onChange, combineDateTime]
  )

  const handleDateSelect = (range: DateRange | undefined) => {
    setDateRange(range)
    updateParent(range, startTime, endTime)
  }

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value
    setStartTime(time)
    updateParent(dateRange, time, endTime)
  }

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value
    setEndTime(time)
    updateParent(dateRange, startTime, time)
  }

  // Format display string with date and time
  const formatDisplay = () => {
    if (!dateRange?.from) return null
    
    const fromDate = format(dateRange.from, "LLL dd, y")
    const toDate = dateRange.to ? format(dateRange.to, "LLL dd, y") : fromDate
    
    if (fromDate === toDate) {
      return `${fromDate} • ${startTime} - ${endTime}`
    }
    return `${fromDate} ${startTime} - ${toDate} ${endTime}`
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger render={
          <Button
            id={id}
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 size-4" />
            {formatDisplay() || <span>Pick date & time range</span>}
          </Button>
        } />
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col">
            <Calendar
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={handleDateSelect}
              numberOfMonths={2}
            />
            <Separator />
            <div className="flex items-center gap-4 p-3">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Start:</span>
                <Input
                  type="time"
                  value={startTime}
                  onChange={handleStartTimeChange}
                  disabled={disabled || !dateRange?.from}
                  className="w-28"
                />
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">End:</span>
                <Input
                  type="time"
                  value={endTime}
                  onChange={handleEndTimeChange}
                  disabled={disabled || !dateRange?.from}
                  className="w-28"
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export { DateTimeRangePicker }
export type { DateTimeRangePickerProps }
