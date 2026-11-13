update volunteers set units = array_prepend('Voluntariado General', units)
  where not (units @> array['Voluntariado General']::text[]);
-- Retirar la antigua opción del catálogo y de las membresías existentes.
delete from units where name = 'Otros';
update volunteers set units = array_remove(units, 'Otros')
  where units @> array['Otros']::text[];

alter table volunteers validate constraint volunteers_general_unit_required;
