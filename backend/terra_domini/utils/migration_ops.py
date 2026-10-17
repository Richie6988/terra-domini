"""
Idempotent migration operations.

Some dev DBs already got these tables/columns through ensure_db.py or manual
SQL, others never did. These ops update Django state as usual but skip the
DB change when the table / column / index already exists — works on SQLite
and PostgreSQL (uses Django introspection, no raw SQL).
"""
from django.db import migrations


def _tables(schema_editor):
    return set(schema_editor.connection.introspection.table_names())


def _columns(schema_editor, table):
    conn = schema_editor.connection
    with conn.cursor() as c:
        return {col.name for col in conn.introspection.get_table_description(c, table)}


def _constraints(schema_editor, table):
    conn = schema_editor.connection
    with conn.cursor() as c:
        return set(conn.introspection.get_constraints(c, table))


class CreateModelIfMissing(migrations.CreateModel):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = to_state.apps.get_model(app_label, self.name)
        if model._meta.db_table in _tables(schema_editor):
            return
        super().database_forwards(app_label, schema_editor, from_state, to_state)


class AddFieldIfMissing(migrations.AddField):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = to_state.apps.get_model(app_label, self.model_name)
        column = model._meta.get_field(self.name).column
        if column in _columns(schema_editor, model._meta.db_table):
            return
        super().database_forwards(app_label, schema_editor, from_state, to_state)


class AddIndexIfMissing(migrations.AddIndex):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = to_state.apps.get_model(app_label, self.model_name)
        if self.index.name in _constraints(schema_editor, model._meta.db_table):
            return
        super().database_forwards(app_label, schema_editor, from_state, to_state)
