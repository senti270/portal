package kr.cdcdcd.todo_widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import org.json.JSONArray
import es.antonborri.home_widget.HomeWidgetPlugin

class TodoWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val widgetData = HomeWidgetPlugin.getData(context)
        val views = RemoteViews(context.packageName, R.layout.todo_widget)

        // 할일 개수
        val todoCount = widgetData.getInt("todo_count", 0)
        views.setTextViewText(R.id.widget_title, "할일 $todoCount개")

        // 할일 목록
        val todosJson = widgetData.getString("todos_json", "[]")
        val todos = JSONArray(todosJson)

        // 첫 3개 할일만 표시
        val todoTexts = mutableListOf<String>()
        for (i in 0 until minOf(3, todos.length())) {
            val todo = todos.getJSONObject(i)
            val task = todo.getString("task")
            val requester = todo.optString("requester", "")
            todoTexts.add("□ $task${if (requester.isNotEmpty()) " - $requester" else ""}")
        }

        views.setTextViewText(
            R.id.widget_todo_1,
            todoTexts.getOrNull(0) ?: ""
        )
        views.setTextViewText(
            R.id.widget_todo_2,
            todoTexts.getOrNull(1) ?: ""
        )
        views.setTextViewText(
            R.id.widget_todo_3,
            todoTexts.getOrNull(2) ?: ""
        )

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}



