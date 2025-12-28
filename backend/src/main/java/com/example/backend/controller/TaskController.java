package com.example.backend.controller;

import com.example.backend.dto.TaskDTO;
import com.example.backend.entity.Task;
import com.example.backend.entity.Pond;
import com.example.backend.repository.TaskRepository;
import com.example.backend.repository.PondRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = "*")
public class TaskController {
    
    @Autowired
    private TaskRepository taskRepository;
    
    @Autowired
    private PondRepository pondRepository;
    
    // Get all tasks
    @GetMapping
    public ResponseEntity<Map<String, Object>> getAllTasks() {
        try {
            List<Task> tasks = taskRepository.findAll();
            List<TaskDTO> dtos = tasks.stream().map(this::convertToDTO).collect(Collectors.toList());
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", dtos);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Error fetching tasks: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // Get task by ID
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getTaskById(@PathVariable Long id) {
        try {
            Optional<Task> taskOpt = taskRepository.findById(id);
            if (taskOpt.isPresent()) {
                TaskDTO dto = convertToDTO(taskOpt.get());
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("data", dto);
                return ResponseEntity.ok(response);
            } else {
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("message", "Task not found");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Error fetching task: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // Get tasks filtered by status
    @GetMapping("/status/{status}")
    public ResponseEntity<Map<String, Object>> getTasksByStatus(@PathVariable String status) {
        try {
            List<Task> tasks = taskRepository.findByStatus(status);
            List<TaskDTO> dtos = tasks.stream().map(this::convertToDTO).collect(Collectors.toList());
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", dtos);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Error fetching tasks: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // Get tasks filtered by priority
    @GetMapping("/priority/{priority}")
    public ResponseEntity<Map<String, Object>> getTasksByPriority(@PathVariable String priority) {
        try {
            List<Task> tasks = taskRepository.findByPriority(priority);
            List<TaskDTO> dtos = tasks.stream().map(this::convertToDTO).collect(Collectors.toList());
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", dtos);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Error fetching tasks: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // Get overdue tasks
    @GetMapping("/overdue")
    public ResponseEntity<Map<String, Object>> getOverdueTasks() {
        try {
            List<Task> tasks = taskRepository.findOverdueTasks(LocalDateTime.now());
            List<TaskDTO> dtos = tasks.stream().map(this::convertToDTO).collect(Collectors.toList());
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", dtos);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Error fetching tasks: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // Create new task
    @PostMapping
    public ResponseEntity<Map<String, Object>> createTask(@RequestBody TaskDTO taskDTO) {
        try {
            Task task = new Task();
            updateEntityFromDTO(task, taskDTO);
            
            Task savedTask = taskRepository.save(task);
            TaskDTO responseDTO = convertToDTO(savedTask);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Task created successfully");
            response.put("data", responseDTO);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Error creating task: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // Update task
    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateTask(
            @PathVariable Long id, 
            @RequestBody TaskDTO taskDTO) {
        try {
            Optional<Task> taskOpt = taskRepository.findById(id);
            if (taskOpt.isPresent()) {
                Task task = taskOpt.get();
                updateEntityFromDTO(task, taskDTO);
                
                // Auto-set completedDate when status changes to completed
                if ("completed".equals(taskDTO.getStatus()) && task.getCompletedDate() == null) {
                    task.setCompletedDate(LocalDateTime.now());
                }
                
                Task savedTask = taskRepository.save(task);
                TaskDTO responseDTO = convertToDTO(savedTask);
                
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("message", "Task updated successfully");
                response.put("data", responseDTO);
                return ResponseEntity.ok(response);
            } else {
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("message", "Task not found");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Error updating task: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // Add note to task
    @PostMapping("/{id}/notes")
    public ResponseEntity<Map<String, Object>> addNote(
            @PathVariable Long id, 
            @RequestBody Map<String, String> noteData) {
        try {
            Optional<Task> taskOpt = taskRepository.findById(id);
            if (taskOpt.isPresent()) {
                Task task = taskOpt.get();
                String note = noteData.get("note");
                if (note != null && !note.trim().isEmpty()) {
                    String timestampedNote = LocalDateTime.now().toString() + ": " + note;
                    
                    // Append to existing notes (stored as newline-separated string)
                    String existingNotes = task.getNotes();
                    if (existingNotes == null || existingNotes.isEmpty()) {
                        task.setNotes(timestampedNote);
                    } else {
                        task.setNotes(existingNotes + "\n" + timestampedNote);
                    }
                    
                    Task savedTask = taskRepository.save(task);
                    TaskDTO responseDTO = convertToDTO(savedTask);
                    
                    Map<String, Object> response = new HashMap<>();
                    response.put("success", true);
                    response.put("message", "Note added successfully");
                    response.put("data", responseDTO);
                    return ResponseEntity.ok(response);
                } else {
                    Map<String, Object> error = new HashMap<>();
                    error.put("success", false);
                    error.put("message", "Note cannot be empty");
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
                }
            } else {
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("message", "Task not found");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Error adding note: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // Delete task
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteTask(@PathVariable Long id) {
        try {
            if (taskRepository.existsById(id)) {
                taskRepository.deleteById(id);
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("message", "Task deleted successfully");
                return ResponseEntity.ok(response);
            } else {
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("message", "Task not found");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Error deleting task: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // Helper: Convert Entity to DTO
    private TaskDTO convertToDTO(Task task) {
        TaskDTO dto = new TaskDTO();
        dto.setId(task.getId());
        dto.setTitle(task.getTitle());
        dto.setDescription(task.getDescription());
        dto.setPriority(task.getPriority());
        dto.setStatus(task.getStatus());
        dto.setType(task.getType());
        dto.setDueDate(task.getDueDate());
        dto.setCreatedDate(task.getCreatedDate());
        dto.setCompletedDate(task.getCompletedDate());
        dto.setSnoozeUntil(task.getSnoozeUntil());
        
        // Convert notes string to list
        if (task.getNotes() != null && !task.getNotes().isEmpty()) {
            dto.setNotes(java.util.Arrays.asList(task.getNotes().split("\n")));
        } else {
            dto.setNotes(new java.util.ArrayList<>());
        }
        
        dto.setLinkedParameter(task.getLinkedParameter());
        dto.setAutoCloseEnabled(task.getAutoCloseEnabled());
        dto.setAssignedTo(task.getAssignedTo());
        if (task.getPond() != null) {
            dto.setPondId(task.getPond().getId());
        }
        return dto;
    }
    
    // Helper: Update Entity from DTO
    private void updateEntityFromDTO(Task task, TaskDTO dto) {
        if (dto.getTitle() != null) task.setTitle(dto.getTitle());
        if (dto.getDescription() != null) task.setDescription(dto.getDescription());
        if (dto.getPriority() != null) task.setPriority(dto.getPriority());
        if (dto.getStatus() != null) task.setStatus(dto.getStatus());
        if (dto.getType() != null) task.setType(dto.getType());
        if (dto.getDueDate() != null) task.setDueDate(dto.getDueDate());
        if (dto.getSnoozeUntil() != null) task.setSnoozeUntil(dto.getSnoozeUntil());
        
        // Convert notes list to string
        if (dto.getNotes() != null) {
            task.setNotes(String.join("\n", dto.getNotes()));
        }
        
        if (dto.getLinkedParameter() != null) task.setLinkedParameter(dto.getLinkedParameter());
        if (dto.getAutoCloseEnabled() != null) task.setAutoCloseEnabled(dto.getAutoCloseEnabled());
        if (dto.getAssignedTo() != null) task.setAssignedTo(dto.getAssignedTo());
        
        // Handle pond relationship
        if (dto.getPondId() != null) {
            Optional<Pond> pondOpt = pondRepository.findById(dto.getPondId());
            pondOpt.ifPresent(task::setPond);
        }
    }
}
