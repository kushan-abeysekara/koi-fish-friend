package com.example.backend.repository;

import com.example.backend.entity.Task;
import com.example.backend.entity.Pond;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
    
    // Find by pond
    List<Task> findByPond(Pond pond);
    
    // Find by status
    List<Task> findByStatus(String status);
    
    // Find by priority
    List<Task> findByPriority(String priority);
    
    // Find by type
    List<Task> findByType(String type);
    
    // Find by status and priority
    List<Task> findByStatusAndPriority(String status, String priority);
    
    // Find by pond and status
    List<Task> findByPondAndStatus(Pond pond, String status);
    
    // Find overdue tasks
    @Query("SELECT t FROM Task t WHERE t.dueDate < :now AND t.status != 'completed'")
    List<Task> findOverdueTasks(@Param("now") LocalDateTime now);
    
    // Find tasks due within a date range
    @Query("SELECT t FROM Task t WHERE t.dueDate BETWEEN :startDate AND :endDate")
    List<Task> findTasksByDueDateRange(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);
    
    // Find tasks by assigned user
    List<Task> findByAssignedTo(String assignedTo);
    
    // Find tasks with auto-close enabled
    List<Task> findByAutoCloseEnabled(Boolean autoCloseEnabled);
    
    // Find snoozed tasks that should be reactivated
    @Query("SELECT t FROM Task t WHERE t.status = 'snoozed' AND t.snoozeUntil <= :now")
    List<Task> findTasksToReactivate(@Param("now") LocalDateTime now);
}
