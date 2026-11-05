import Foundation
import Intents

/// SiriKit's Lists domain, for what no App Shortcut phrase matches. "Füge Zahnpasta zu Hummlist
/// hinzu" with an item the app never suggested reaches the app as an INAddTasksIntent; without
/// these handlers Siri answered "Hummlist unterstützt das nicht" (job 92). AppDelegate hands them
/// out in-app (`application(_:handlerFor:)`, no Intents extension). The titles go to `voice` like
/// AddItemsIntent's dictation; the household has one list, so a named list is ignored.
///
/// Every failure, signed out and no household included, answers `.failure`: Siri says its own
/// localized "couldn't do that" and stays in its sheet. `.failureRequiringAppLaunch` made iOS open
/// the app instead (job 97). A Lists response carries only a code, `addedTasks` and
/// `modifiedTaskList`, so the app's own sentences (SiriCopy) reach only the App Shortcuts.
final class AddTasksHandler: NSObject, INAddTasksIntentHandling {
  let client: VoiceClient

  init(client: VoiceClient) {
    self.client = client
  }

  func resolveTaskTitles(
    for intent: INAddTasksIntent, with completion: @escaping ([INSpeakableStringResolutionResult]) -> Void
  ) {
    let titles = Self.titles(intent)
    completion(titles.isEmpty ? [.needsValue()] : titles.map { .success(with: INSpeakableString(spokenPhrase: $0)) })
  }

  func resolveTargetTaskList(
    for intent: INAddTasksIntent, with completion: @escaping (INAddTasksTargetTaskListResolutionResult) -> Void
  ) {
    completion(.notRequired())
  }

  func handle(intent: INAddTasksIntent, completion: @escaping (INAddTasksIntentResponse) -> Void) {
    Task { completion(await respond(to: intent)) }
  }

  func respond(to intent: INAddTasksIntent) async -> INAddTasksIntentResponse {
    let titles = Self.titles(intent)
    let text = titles.joined(separator: ", ")
    let result = await client.send(text: text, mode: .add, lang: VoiceLanguage.of(text))
    switch result {
    case .added, .nothingAdded:
      let response = INAddTasksIntentResponse(code: .success, userActivity: nil)
      response.addedTasks = titles.map(task)
      return response
    case .read, .lockedHousehold, .failed:
      return INAddTasksIntentResponse(code: .failure, userActivity: nil)
    }
  }

  static func titles(_ intent: INAddTasksIntent) -> [String] {
    (intent.taskTitles ?? [])
      .map { $0.spokenPhrase.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
  }
}

/// "Was steht auf Hummlist?" in a wording no App Shortcut phrase has: Siri reads the open items
/// it gets back as tasks.
final class SearchTasksHandler: NSObject, INSearchForNotebookItemsIntentHandling {
  let client: VoiceClient

  init(client: VoiceClient) {
    self.client = client
  }

  func handle(
    intent: INSearchForNotebookItemsIntent, completion: @escaping (INSearchForNotebookItemsIntentResponse) -> Void
  ) {
    Task { completion(await respond()) }
  }

  func respond() async -> INSearchForNotebookItemsIntentResponse {
    switch await client.send(text: nil, mode: .read, lang: VoiceLanguage.of(nil)) {
    case .read(_, let items):
      let response = INSearchForNotebookItemsIntentResponse(code: .success, userActivity: nil)
      let tasks = items.map(task)
      response.tasks = tasks
      response.taskLists = [
        INTaskList(
          title: INSpeakableString(spokenPhrase: "Hummlist"), tasks: tasks, groupName: nil,
          createdDateComponents: nil, modifiedDateComponents: nil, identifier: nil)
      ]
      return response
    case .added, .nothingAdded, .lockedHousehold, .failed:
      return INSearchForNotebookItemsIntentResponse(code: .failure, userActivity: nil)
    }
  }
}

private func task(_ title: String) -> INTask {
  INTask(
    title: INSpeakableString(spokenPhrase: title), status: .notCompleted, taskType: .completable,
    spatialEventTrigger: nil, temporalEventTrigger: nil, createdDateComponents: nil,
    modifiedDateComponents: nil, identifier: nil)
}
