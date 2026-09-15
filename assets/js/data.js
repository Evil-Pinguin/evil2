/* D01T01 — контент тренажёра.
   Материал разбит на «дни» (фильтр) и квесты.
   items — банк команд: из него собираются два квиза:
     pick  — дана задача, выбрать команду/код;
     what  — дан код, выбрать что он делает. */
window.STUDY_DATA = {
  meta: {
    code: 'D01T01',
    title: 'Знакомство с Linux и Git-системой',
    repo: 'D01T01_ID_1577481-1',
    subtitle: 'Тренажёр по обязательной и бонусной части проекта'
  },

  days: [
    { id: 'all',   label: 'Все дни', short: 'Все',   hint: 'Quest 1–10' },
    { id: 'd1',    label: 'День 1',  short: 'День 1', hint: 'Quest 1–4' },
    { id: 'd2',    label: 'День 2',  short: 'День 2', hint: 'Quest 5–7 · финал' },
    { id: 'bonus', label: 'Бонус',   short: 'Бонус',  hint: 'Quest 8–10' }
  ],

  /* ---------- Общие правила (вводная карточка) ---------- */
  intro: {
    id: 'intro',
    days: ['all', 'd1'],
    kicker: 'Общие правила',
    title: 'Как устроена работа',
    body: [
      'Все команды выполняются в терминале Linux/WSL.',
      'После клонирования репозитория структура выглядит так:'
    ],
    tree: ['D01T01_ID_1577481-1/', '└── src/'],
    steps: [
      { t: 'Рабочая директория — src', d: 'Для работы с файлами проекта используется директория src. Большинство команд предполагает, что текущая директория — именно она.', cmds: [{ c: 'cd ~/D01T01_ID_1577481-1/src', n: 'перейти в src' }, { c: 'pwd', n: 'проверить, где вы находитесь' }] }
    ]
  },

  /* ---------- Квесты ---------- */
  quests: [
    {
      id: 'q1', num: 1, day: 'd1',
      title: 'Знакомство с Linux и Git',
      goal: 'Клонировать репозиторий проекта и создать рабочую ветку develop.',
      tags: ['clone', 'branch', 'develop'],
      steps: [
        {
          t: 'Перейти в домашнюю директорию',
          d: 'Команда cd используется для перехода между директориями. Путь ~ — сокращение для домашней директории.',
          cmds: [{ c: 'cd ~', n: 'перейти в домашнюю директорию' }, { c: 'pwd', n: 'проверить текущую директорию' }]
        },
        {
          t: 'Клонировать репозиторий',
          d: 'Вместо USERNAME указывается логин пользователя. После выполнения появится директория D01T01_ID_1577481-1.',
          cmds: [
            { c: 'git clone ssh://git@git-ssh.21-school.ru:2222/students_repo/USERNAME/D01T01_ID_1577481-1.git', n: 'клонирование по SSH (порт 2222)' },
            { c: 'cd D01T01_ID_1577481-1', n: 'зайти в директорию проекта' },
            { c: 'cd src', n: 'зайти в рабочую директорию' }
          ]
        },
        {
          t: 'Проверить состояние Git',
          d: 'Команда git status показывает текущую ветку, изменённые файлы и наличие незакоммиченных изменений.',
          cmds: [{ c: 'git status', n: 'состояние рабочего дерева' }]
        },
        {
          t: 'Посмотреть существующие ветки',
          d: 'Обычно изначально будет только master. Звёздочка * показывает текущую ветку.',
          cmds: [{ c: 'git branch', n: 'список веток' }],
          out: '* master'
        },
        {
          t: 'Создать develop',
          d: 'Команда одновременно создаёт ветку develop и переключает на неё.',
          cmds: [{ c: 'git checkout -b develop', n: 'создать ветку и переключиться' }, { c: 'git branch', n: 'проверка: звёздочка стоит на develop' }],
          out: '* develop\n  master'
        }
      ],
      result: 'На руках клон проекта и активная ветка develop — база для всех следующих квестов.'
    },
    {
      id: 'q2', num: 2, day: 'd1',
      title: 'AI module',
      goal: 'Восстановить необходимые права и данные AI-модулей.',
      tags: ['chmod', 'cat', 'commit'],
      pre: 'Убедиться, что работа идёт в D01T01_ID_1577481-1/src — pwd.',
      steps: [
        {
          t: 'Найти AI-модуль',
          d: 'Смотрим содержимое директории, при необходимости заходим в директорию модуля. Ключ -l показывает подробную информацию, включая права доступа.',
          cmds: [{ c: 'ls', n: 'содержимое текущей директории' }, { c: 'cd ai_initial_module', n: 'перейти в директорию модуля' }, { c: 'ls -l', n: 'подробный список файлов с правами' }]
        },
        {
          t: 'Сделать скрипт исполняемым',
          d: 'chmod +x добавляет файлу право на выполнение. В начале строки должна появиться буква x, например -rwxr-xr-x.',
          cmds: [{ c: 'chmod +x ai_initial_module.sh', n: 'добавить право на выполнение' }, { c: 'ls -l ai_initial_module.sh', n: 'проверить права' }],
          out: '-rwxr-xr-x'
        },
        {
          t: 'Проверить файл с данными',
          d: 'В файле должны находиться числа 1, 2, 3, 4, 5. Если данные повреждены — привести файл к такому виду.',
          cmds: [{ c: 'cat important_data_for_ai_module_2.txt', n: 'посмотреть содержимое файла' }],
          out: '1\n2\n3\n4\n5'
        },
        {
          t: 'Запустить AI-модуль',
          d: './ означает запуск файла из текущей директории.',
          cmds: [{ c: './ai_initial_module.sh', n: 'запустить скрипт' }]
        },
        {
          t: 'Зафиксировать изменения',
          d: 'Возвращаемся в src и сохраняем результат в истории Git.',
          cmds: [
            { c: 'cd ..', n: 'вернуться в src' },
            { c: 'git status', n: 'посмотреть изменения' },
            { c: 'git add .', n: 'добавить все изменения в индекс' },
            { c: 'git commit -m "fix: restore AI modules"', n: 'создать коммит' }
          ]
        }
      ],
      result: 'Скрипт исполняем, данные целые, изменения закоммичены.'
    },
    {
      id: 'q3', num: 3, day: 'd1',
      title: 'Door management',
      goal: 'Привести файлы управления дверями к необходимой структуре.',
      tags: ['mkdir', 'find', 'kill'],
      tree: ['src/', '└── door_management_files/', '    ├── door_configuration/', '    ├── door_logs/', '    └── door_map/'],
      steps: [
        {
          t: 'Создать директории',
          d: 'mkdir -p создаёт директории вместе с отсутствующими родительскими директориями.',
          cmds: [
            { c: 'mkdir -p door_management_files/door_configuration', n: '' },
            { c: 'mkdir -p door_management_files/door_logs', n: '' },
            { c: 'mkdir -p door_management_files/door_map', n: '' }
          ]
        },
        {
          t: 'Разложить конфигурационные файлы',
          d: 'В door_configuration должны находиться door_1.conf … door_16.conf и door_21.conf — всего 17 конфигурационных файлов.',
          cmds: [{ c: 'ls door_management_files/door_configuration', n: 'проверить список' }]
        },
        {
          t: 'Разложить файлы журналов',
          d: 'В door_logs должны находиться door_1.log … door_16.log — всего 16 файлов.',
          cmds: [{ c: 'ls door_management_files/door_logs', n: 'проверить список' }]
        },
        {
          t: 'Разместить карту',
          d: 'В door_map должен находиться файл door_map_1.1.',
          cmds: [{ c: 'ls door_management_files/door_map', n: 'проверить список' }]
        },
        {
          t: 'Проверить общее количество файлов',
          d: '17 конфигураций + 16 логов + 1 карта = 34 файла. Это и должен показать подсчёт.',
          cmds: [{ c: 'find door_management_files -type f | wc -l', n: 'посчитать файлы' }],
          out: '34'
        },
        {
          t: 'Исправить права скриптов',
          d: 'Обоим скриптам управления нужен флаг выполнения.',
          cmds: [{ c: 'chmod +x ai_door_management_module.sh', n: '' }, { c: 'chmod +x ai_door_control.sh', n: '' }, { c: 'ls -l ai_door_management_module.sh', n: 'проверить права' }, { c: 'ls -l ai_door_control.sh', n: 'проверить права' }]
        },
        {
          t: 'Запустить модуль управления',
          d: 'Если процесс продолжает работать — находим его через ps и завершаем по фактическому PID (1513 — только пример).',
          cmds: [
            { c: './ai_door_management_module.sh', n: 'запустить модуль' },
            { c: 'ps aux | grep ai_door', n: 'найти процесс' },
            { c: 'kill PID', n: 'завершить процесс (PID — фактический)' }
          ]
        },
        {
          t: 'Создать коммит',
          d: 'Фиксируем итог квеста в Git.',
          cmds: [{ c: 'git add .', n: '' }, { c: 'git commit -m "feat: complete door management and control quests"', n: '' }]
        }
      ],
      result: 'Структура из 34 файлов, скрипты исполняемы, изменения закоммичены.'
    },
    {
      id: 'q4', num: 4, day: 'd1',
      title: 'Door control',
      goal: 'Проверить работу системы управления дверями и необходимые права доступа.',
      tags: ['find', 'chmod', 'status'],
      steps: [
        { t: 'Проверить структуру', d: 'Выводим все файлы внутри door_management_files.', cmds: [{ c: 'find door_management_files -type f', n: 'список всех файлов' }] },
        { t: 'Проверить исполняемые права', d: 'Смотрим права у обоих скриптов управления.', cmds: [{ c: 'ls -l ai_door_management_module.sh', n: '' }, { c: 'ls -l ai_door_control.sh', n: '' }] },
        { t: 'Если права отсутствуют', d: 'Добавляем флаг выполнения повторно — команда безопасна и идемпотентна.', cmds: [{ c: 'chmod +x ai_door_management_module.sh', n: '' }, { c: 'chmod +x ai_door_control.sh', n: '' }] },
        { t: 'Запустить модуль', d: 'Проверяем, что система управления действительно работает.', cmds: [{ c: './ai_door_management_module.sh', n: 'запуск модуля' }] },
        { t: 'Проверить Git', d: 'Убедиться, что рабочее дерево чистое либо изменения относятся к текущему квесту.', cmds: [{ c: 'git status', n: 'состояние рабочего дерева' }] }
      ],
      note: 'Если изменения Quest 3 и Quest 4 уже были сохранены одним коммитом, второй одинаковый коммит создавать не нужно.',
      result: 'Права на месте, модуль запускается, лишних изменений в Git нет.'
    },
    {
      id: 'q5', num: 5, day: 'd2',
      title: 'Открытие первой двери',
      goal: 'Изменить состояние первой двери с CLOSED на OPEN.',
      tags: ['vim', 'config', 'commit'],
      file: 'src/door_management_files/door_configuration/door_1.conf',
      steps: [
        { t: 'Открыть файл', d: 'Можно использовать Vim либо другой текстовый редактор.', cmds: [{ c: 'vim door_management_files/door_configuration/door_1.conf', n: 'открыть файл в Vim' }] },
        { t: 'Найти параметр STATUS', d: 'Меняем значение параметра: было STATUS: CLOSED — стало STATUS: OPEN.', diff: { from: 'STATUS: CLOSED', to: 'STATUS: OPEN' } },
        { t: 'Проверить результат', d: 'В выводе команды должно быть STATUS: OPEN.', cmds: [{ c: 'cat door_management_files/door_configuration/door_1.conf', n: 'проверить файл' }], out: 'STATUS: OPEN' },
        { t: 'Создать коммит', d: 'Коммитим только этот файл — так история остаётся читаемой.', cmds: [{ c: 'git add door_management_files/door_configuration/door_1.conf', n: '' }, { c: 'git commit -m "feat: open first door"', n: '' }] }
      ],
      result: 'Первая дверь в состоянии OPEN, изменение зафиксировано отдельным коммитом.'
    },
    {
      id: 'q6', num: 6, day: 'd2',
      title: 'AI Help',
      goal: 'Сгенерировать ключи, объединить их и получить main.key.',
      tags: ['keys', 'scripts', 'commit'],
      steps: [
        { t: 'Перейти в ai_help', d: 'Смотрим содержимое директории с подробностями.', cmds: [{ c: 'cd ai_help', n: 'перейти в директорию' }, { c: 'ls -l', n: 'подробный список' }] },
        { t: 'Сделать keygen.sh исполняемым', d: 'Без флага выполнения запуск скрипта не сработает.', cmds: [{ c: 'chmod +x keygen.sh', n: 'добавить право на выполнение' }] },
        { t: 'Запустить генератор', d: 'Скрипт создаст большое количество файлов. После выполнения смотрим результат.', cmds: [{ c: './keygen.sh', n: 'запустить генератор' }, { c: 'ls', n: 'посмотреть результат' }] },
        { t: 'Оставить необходимые .key файлы', d: 'Проверяем количество ключей: в выполненном варианте получилось 60. Лишние файлы удаляются согласно условиям задания.', cmds: [{ c: 'find . -name "*.key" | wc -l', n: 'посчитать ключи' }], out: '60' },
        { t: 'Запустить объединение ключей', d: 'Скрипт unifier.sh объединяет ключи в один. Ожидаемый результат — Ok.', cmds: [{ c: 'chmod +x unifier.sh', n: '' }, { c: './unifier.sh', n: 'объединить ключи' }], out: 'Ok.' },
        { t: 'Проверить main.key', d: 'Значение зависит от вашего прогона: в выполненном варианте вышло 694. Главное — использовать main.key, созданный вашим unifier.sh.', cmds: [{ c: 'cat main.key', n: 'посмотреть ключ' }], out: '694' },
        { t: 'Вернуться в src и закоммитить', d: 'Сохраняем созданные ключи в истории.', cmds: [{ c: 'cd ..', n: 'вернуться в src' }, { c: 'git status', n: '' }, { c: 'git add .', n: '' }, { c: 'git commit -m "feat: generate and unify AI key"', n: '' }] }
      ],
      result: 'Есть main.key, изменения закоммичены.'
    },
    {
      id: 'q7', num: 7, day: 'd2',
      title: 'Branches',
      goal: 'Создать необходимые ветки и выполнить слияние согласно инструкции из src/git_for_human.',
      tags: ['branch', 'merge', 'release'],
      branches: ['develop', 'key-branch', 'feature/3-key', 'release/1.0'],
      steps: [
        { t: 'Начать работу с develop', d: 'Переключаемся и проверяем список веток: текущая — develop.', cmds: [{ c: 'git checkout develop', n: '' }, { c: 'git branch', n: 'ожидается * develop' }] },
        { t: 'Создать key-branch', d: 'Новая ветка от develop. В списке будут develop, key-branch, master.', cmds: [{ c: 'git checkout -b key-branch', n: '' }, { c: 'git branch', n: '' }] },
        { t: 'Создать main-2.key', d: 'Копируем основной ключ и коммитим. Название key-branch должно быть в начале сообщения коммита.', cmds: [{ c: 'cp ai_help/main.key ai_help/main-2.key', n: 'копируем ключ' }, { c: 'ls -l ai_help/main*.key', n: 'должны быть main.key и main-2.key' }, { c: 'git add ai_help/main-2.key', n: '' }, { c: 'git commit -m "key-branch: add main-2.key"', n: '' }] },
        { t: 'Создать feature/3-key', d: 'Ветка создаётся от key-branch — текущая ветка станет feature/3-key.', cmds: [{ c: 'git checkout -b feature/3-key', n: '' }, { c: 'git branch', n: '' }] },
        { t: 'Создать main-3.key', d: 'Копируем ключ в третий файл и коммитим. Название ветки feature/3-key — в начале сообщения коммита.', cmds: [{ c: 'cp ai_help/main.key ai_help/main-3.key', n: '' }, { c: 'ls -l ai_help/main*.key', n: 'теперь три файла' }, { c: 'git add ai_help/main-3.key', n: '' }, { c: 'git commit -m "feature/3-key: add main-3.key"', n: '' }] },
        { t: 'Объединить feature/3-key с key-branch', d: 'Переключаемся на key-branch и вливаем. Fast-forward — нормальный результат.', cmds: [{ c: 'git checkout key-branch', n: '' }, { c: 'git merge feature/3-key', n: 'ожидается Fast-forward' }, { c: 'git log --oneline --graph --all --decorate -5', n: 'проверить историю' }] },
        { t: 'Создать release/1.0 от develop', d: 'Возвращаемся на develop и создаём релизную ветку.', cmds: [{ c: 'git checkout develop', n: '' }, { c: 'git checkout -b release/1.0', n: '' }, { c: 'git branch', n: 'текущая — release/1.0' }] },
        { t: 'Объединить key-branch с develop', d: 'После слияния develop получает main-2.key и main-3.key.', cmds: [{ c: 'git checkout develop', n: '' }, { c: 'git merge key-branch', n: 'ожидается Fast-forward' }] },
        { t: 'Объединить develop с release/1.0', d: 'Теперь release/1.0 содержит изменения develop.', cmds: [{ c: 'git checkout release/1.0', n: '' }, { c: 'git merge develop', n: '' }] },
        { t: 'Финальная проверка', d: 'В списке веток должны быть develop, feature/3-key, key-branch, master, release/1.0. История — графом.', cmds: [{ c: 'git branch', n: '' }, { c: 'git log --oneline --graph --all --decorate -10', n: '' }], out: '* 08bf3d2 (HEAD -> release/1.0, key-branch, feature/3-key, develop) feature/3-key: add main-3.key\n* 0595514 key-branch: add main-2.key\n* 66aa487 feat: generate and unify AI key' }
      ],
      result: 'Четыре ветки и корректный граф истории; release/1.0 вобрал изменения develop.'
    },
    {
      id: 'q8', num: 8, day: 'bonus',
      title: 'Bonus — Vim',
      goal: 'Отработать редактирование файла в Vim с фиксацией изменений в журнале.',
      tags: ['bonus', 'vim', 'log'],
      branch: 'develop',
      steps: [
        { t: 'Зафиксировать исходное состояние', d: 'Работаем в ветке develop. Фиксируем исходное состояние src/history_of_vim.txt.', cmds: [{ c: 'git checkout develop', n: '' }, { c: 'cat src/history_of_vim.txt', n: 'исходное состояние' }] },
        { t: 'Записать информацию в files.log', d: 'Формат записи: путь к файлу — размер в байтах — дата и время — sha-сумма файла — алгоритм вычисления sha.', cmds: [{ c: 'stat -c "%s" src/history_of_vim.txt', n: 'размер в байтах' }, { c: 'date "+%Y-%m-%d %H:%M:%S"', n: 'дата и время' }, { c: 'sha256sum src/history_of_vim.txt', n: 'sha-сумма (алгоритм sha256)' }] },
        { t: 'Дополнить историю Vim', d: 'Добавляем версии после 2001 года. Редактирование — в Vim.', cmds: [{ c: 'vim src/history_of_vim.txt', n: 'редактировать в Vim' }] },
        { t: 'Добавить заголовок', d: 'В начало файла добавляется заголовок: A Quick Summary Of the History of the Vim Editor.', cmds: [], note: 'Заголовок в самом начале файла, затем — история версий, включая версии после 2001 года.' },
        { t: 'Записывать files.log после каждого изменения', d: 'После каждого изменения файла — новая строка в src/files.log в заданном формате.', cmds: [{ c: 'cat src/files.log', n: 'проверить журнал' }] }
      ],
      result: 'history_of_vim.txt дополнен, заголовок на месте, каждое изменение отражено в files.log.'
    },
    {
      id: 'q9', num: 9, day: 'bonus',
      title: 'Bonus — Script',
      goal: 'Написать src/edit.sh: замена строки в файле с записью в журнал.',
      tags: ['bonus', 'bash', 'script'],
      steps: [
        { t: 'Что должен делать скрипт', d: 'Скрипт принимает путь к файлу, строку для поиска и строку для замены. Выполняет непосредственную замену в файле, пишет информацию об изменении в src/files.log и корректно обрабатывает ошибочные и крайние ситуации.', cmds: [{ c: './edit.sh <файл> <что_искать> <на_что_заменить>', n: 'интерфейс скрипта' }] },
        { t: 'Ошибочные и крайние ситуации', d: 'Проверяем: число аргументов, существование файла, строку, которой нет в файле, пустые значения, спецсимволы в шаблонах.', cmds: [{ c: 'chmod +x src/edit.sh', n: 'сделать скрипт исполняемым' }], note: 'Хороший тон — понятное сообщение об ошибке и код возврата, отличный от нуля.' },
        { t: 'Запись в журнал', d: 'После успешной замены в src/files.log попадает строка в формате: путь — размер в байтах — дата и время — sha-сумма — алгоритм sha.', cmds: [{ c: 'cat src/files.log', n: 'проверить запись' }] }
      ],
      result: 'edit.sh работает, ошибочные ситуации не ломают скрипт, журнал ведётся.'
    },
    {
      id: 'q10', num: 10, day: 'bonus',
      title: 'Bonus — GitLab Manual',
      goal: 'Собрать src/gitlab_manual.md со скриншотами по каждому пункту.',
      tags: ['bonus', 'gitlab', 'docs'],
      steps: [
        { t: 'Пункт 1', d: 'Создание личного репозитория с .gitignore и README.md.', cmds: [], note: 'Заголовок + скриншот.' },
        { t: 'Пункт 2', d: 'Создание веток master, develop и feature.', cmds: [], note: 'Заголовок + скриншот.' },
        { t: 'Пункт 3', d: 'Создание Merge Request в develop.', cmds: [], note: 'Заголовок + скриншот.' },
        { t: 'Пункт 4', d: 'Создание Issue и комментария к Issue.', cmds: [], note: 'Заголовок + скриншот.' }
      ],
      result: 'Мануал src/gitlab_manual.md содержит заголовок и соответствующий скриншот для каждого пункта.'
    }
  ],

  /* ---------- Финальная проверка ---------- */
  final: {
    id: 'final',
    days: ['all', 'd2'],
    kicker: 'Перед сдачей',
    title: 'Финальная проверка',
    steps: [
      { t: 'Текущая ветка', cmds: [{ c: 'git branch', n: 'должна быть активна release/1.0' }] },
      { t: 'Отсутствие незакоммиченных изменений', cmds: [{ c: 'git status', n: '' }], out: 'On branch release/1.0\nnothing to commit, working tree clean' },
      { t: 'История', cmds: [{ c: 'git log --oneline --graph --all --decorate -10', n: 'убедиться, что нужные коммиты и ветки существуют' }] }
    ],
    warn: {
      t: 'Важное замечание о git push',
      d: 'Если при выполнении git push origin develop появляется «You are not allowed to push code to this project.», это означает, что удалённый репозиторий не разрешает пользователю напрямую отправлять изменения.',
      bad: ['git push --force', 'git push --force origin develop'],
      good: 'Не пытаться исправлять это через force-push: сначала нужно проверить предусмотренный платформой способ сдачи проекта.'
    }
  },

  /* ---------- Памятка ---------- */
  cheatsheet: {
    id: 'cheatsheet',
    days: ['all', 'd1', 'd2', 'bonus'],
    kicker: 'Шпаргалка',
    title: 'Основные команды',
    groups: [
      { g: 'Навигация', rows: [['pwd', 'показать текущий путь'], ['cd directory', 'перейти в директорию'], ['cd ..', 'вернуться на уровень выше'], ['ls', 'содержимое директории']] },
      { g: 'Файлы и права', rows: [['cat filename', 'посмотреть содержимое файла'], ['cp source destination', 'скопировать файл'], ['chmod +x filename', 'изменить права на выполнение'], ['find . -type f', 'найти файлы']] },
      { g: 'Git — ветки', rows: [['git branch', 'посмотреть текущую ветку'], ['git checkout branch-name', 'перейти на ветку'], ['git checkout -b branch-name', 'создать и сразу перейти на новую ветку'], ['git merge branch-name', 'объединить ветку']] },
      { g: 'Git — изменения', rows: [['git status', 'посмотреть состояние'], ['git add filename', 'добавить файл'], ['git add .', 'добавить все изменения'], ['git commit -m "message"', 'создать коммит']] },
      { g: 'Git — история', rows: [['git log --oneline', 'посмотреть историю'], ['git log --oneline --graph --all --decorate', 'посмотреть историю в виде графа']] }
    ]
  },

  /* ---------- Итоговая последовательность ---------- */
  flow: {
    id: 'flow',
    days: ['all', 'd2'],
    kicker: 'Маршрут',
    title: 'Итоговая последовательность обязательной части',
    chain: ['Quest 1', 'Клонирование + develop', 'Quest 2', 'AI modules', 'Quest 3–4', 'Door management', 'Quest 5', 'Первая дверь → OPEN', 'Quest 6', 'AI Help → main.key', 'Quest 7', 'key-branch → feature/3-key → main-2.key + main-3.key → merge → release/1.0', 'Финальная проверка', 'Сдача'],
    bonus: ['Quest 8, 9 и 10 — бонусные. Проект допускает завершение без выполнения бонусной части.']
  },

  /* ---------- Банк команд для квизов ----------
     fam — семейство команды (одинаковые не попадают в один вопрос как варианты)
     dom — область применения (дистракторы берутся из других областей)      */
  items: [
    // --- Quest 1 ---
    { id: 'i-pwd', day: 'd1', quest: 1, fam: 'pwd', dom: 'nav', cmd: 'pwd', task: 'Узнать, в какой директории вы находитесь сейчас', what: 'Печатает полный путь текущей директории', why: 'pwd = print working directory. Нужна, чтобы убедиться, что работа идёт в src.', hint: 'pwd — сокращение от print working directory.' },
    { id: 'i-cd-home', day: 'd1', quest: 1, fam: 'cd', dom: 'nav', cmd: 'cd ~', task: 'Перейти в домашнюю директорию', what: 'Переходит в домашнюю директорию', why: 'Символ ~ — сокращение для домашней директории пользователя.', hint: 'Тильда ~ — это сокращение для домашней директории.' },
    { id: 'i-cd-repo', day: 'd1', quest: 1, fam: 'cd', dom: 'nav', cmd: 'cd D01T01_ID_1577481-1', task: 'Зайти в директорию проекта сразу после клонирования', what: 'Переходит в директорию проекта D01T01_ID_1577481-1', hint: 'После клонирования появляется директория, имя которой совпадает с именем репозитория.' },
    { id: 'i-cd-src', day: 'd1', quest: 1, fam: 'cd', dom: 'nav-src', cmd: 'cd src', task: 'Перейти в рабочую директорию src внутри проекта', what: 'Переходит в директорию src', hint: 'Рабочая директория проекта называется src, путь пишется без лишних слэшей.' },
    { id: 'i-cd-up', day: 'd1', quest: 2, fam: 'cd-up', dom: 'nav-up', cmd: 'cd ..', task: 'Вернуться из ai_help обратно в src', what: 'Поднимается на одну директорию вверх', why: 'Две точки — родительская директория.', hint: 'Две точки означают родительскую директорию.' },
    { id: 'i-clone', day: 'd1', quest: 1, fam: 'git-clone', dom: 'git-remote', cmd: 'git clone ssh://git@git-ssh.21-school.ru:2222/students_repo/USERNAME/D01T01_ID_1577481-1.git', task: 'Клонировать репозиторий проекта по SSH (порт 2222)', what: 'Клонирует удалённый репозиторий в текущую директорию', why: 'Вместо USERNAME подставляется логин пользователя.', hint: 'В адресе важен порт 2222, а вместо логина в пути стоит USERNAME.' },
    { id: 'i-status', day: 'd1', quest: 1, fam: 'git-status', dom: 'git-view-status', cmd: 'git status', task: 'Посмотреть текущую ветку, изменённые файлы и наличие незакоммиченных изменений', what: 'Показывает текущую ветку, изменённые файлы и незакоммиченные изменения', hint: 'Команда только показывает состояние репозитория и ничего не меняет.' },
    { id: 'i-branch', day: 'd1', quest: 1, fam: 'git-branch', dom: 'git-view-branch', cmd: 'git branch', task: 'Посмотреть существующие ветки — ожидается звёздочка на master', what: 'Выводит список веток; звёздочкой отмечена текущая ветка', why: 'Звёздочка * показывает, в какой ветке вы находитесь.', hint: 'Нужна команда из семейства git без дополнительных ключей.' },
    { id: 'i-co-b', day: 'd2', quest: 7, fam: 'git-checkout-b', dom: 'git-branch-new', cmd: 'git checkout -b develop', task: 'Создать ветку develop и сразу переключиться на неё', what: 'Создаёт новую ветку develop и переключается на неё', why: 'Флаг -b создаёт ветку; без него команда только переключает.', hint: 'За создание новой ветки отвечает один короткий флаг.' },
    { id: 'i-co', day: 'd2', quest: 7, fam: 'git-checkout', dom: 'git-branch-switch', cmd: 'git checkout key-branch', task: 'Переключиться на уже существующую ветку key-branch', what: 'Переключается на существующую ветку key-branch', hint: 'Ветка уже существует, поэтому флаг создания не нужен — только имя ветки.' },

    // --- Quest 2 ---
    { id: 'i-ls', day: 'd1', quest: 2, fam: 'ls', dom: 'inspect', cmd: 'ls', task: 'Вывести просто список файлов в текущей директории', what: 'Показывает список файлов и директорий без деталей', hint: 'Самый простой вариант — без ключей и без пути.' },
    { id: 'i-ls-l', day: 'd1', quest: 2, fam: 'ls', dom: 'inspect', cmd: 'ls -l', task: 'Увидеть права доступа к файлам (появится x у исполняемого)', what: 'Подробный список: права, владелец, размер, дата изменения', why: 'Ключ -l показывает подробную информацию, включая права доступа.', hint: '«Длинный» формат вывода даёт один ключ из одной буквы.' },
    { id: 'i-ls-mask', day: 'd2', quest: 7, fam: 'ls', dom: 'inspect-keys', cmd: 'ls -l ai_help/main*.key', task: 'Убедиться, что рядом с main.key появились main-2.key и main-3.key', what: 'Подробный список всех файлов, подходящих под маску main*.key', hint: 'Можно перечислить ключи маской main*.key — она подходит сразу к трём файлам.' },
    { id: 'i-cat-data', day: 'd1', quest: 2, fam: 'cat', dom: 'read', cmd: 'cat important_data_for_ai_module_2.txt', task: 'Проверить, что в файле лежат числа 1 2 3 4 5', what: 'Выводит содержимое файла important_data_for_ai_module_2.txt в терминал', hint: 'Нужно вывести файл целиком, редактор не требуется.' },
    { id: 'i-cat-key', day: 'd2', quest: 6, fam: 'cat', dom: 'read', cmd: 'cat main.key', task: 'Посмотреть значение полученного ключа main.key (ожидается 694)', what: 'Выводит содержимое main.key на экран', hint: 'Файл всего один, поэтому достаточно вывести его на экран.' },
    { id: 'i-node-module', day: 'd1', quest: 2, fam: 'chmod', dom: 'perm', cmd: 'chmod +x ai_initial_module.sh', task: 'Разрешить запуск файла ai_initial_module.sh', what: 'Добавляет файлу право на выполнение: в правах появляется x', why: 'chmod +x = добавить право execute. Проверка: ls -l, ожидается -rwxr-xr-x.', hint: 'chmod с флагом выполнения и именем файла.' },
    { id: 'i-node-keygen', day: 'd2', quest: 6, fam: 'chmod', dom: 'perm', cmd: 'chmod +x keygen.sh', task: 'Сделать исполняемым генератор ключей keygen.sh', what: 'Добавляет право на выполнение скрипту keygen.sh', hint: 'Права те же, что и у остальных скриптов: добавить выполнение.' },
    { id: 'i-node-edit', day: 'bonus', quest: 9, fam: 'chmod', dom: 'perm', cmd: 'chmod +x src/edit.sh', task: 'Сделать исполняемым собственный скрипт src/edit.sh', what: 'Добавляет право на выполнение скрипту src/edit.sh', hint: 'Скрипт лежит в src, то есть путь начинается с src/.' },
    { id: 'i-run-module', day: 'd1', quest: 2, fam: 'run', dom: 'exec', cmd: './ai_initial_module.sh', task: 'Запустить AI-модуль из текущей директории', what: 'Запускает скрипт из текущей директории', why: './ означает запуск файла из текущей директории.', hint: 'Запуск файла из текущей директории начинается с точки и слэша.' },
    { id: 'i-run-keygen', day: 'd2', quest: 6, fam: 'run', dom: 'exec', cmd: './keygen.sh', task: 'Запустить генератор, который создаст большое количество файлов', what: 'Запускает генератор ключей', hint: 'Скрипт запускается так же, как и другие: из текущей директории.' },
    { id: 'i-run-door', day: 'd1', quest: 3, fam: 'run', dom: 'exec', cmd: './ai_door_management_module.sh', task: 'Запустить модуль управления дверями', what: 'Запускает модуль управления дверями', hint: 'Точка и слэш, затем имя модуля управления дверями.' },
    { id: 'i-commit-ai', day: 'd1', quest: 2, fam: 'git-commit', dom: 'git-commit', cmd: 'git commit -m "fix: restore AI modules"', task: 'Зафиксировать восстановление AI-модулей одним коммитом', what: 'Создаёт коммит с сообщением «fix: restore AI modules»', hint: 'Сообщение коммита начинается с fix: и говорит о восстановлении AI-модулей.' },

    // --- Quest 3-4 ---
    { id: 'i-mkdir-conf', day: 'd1', quest: 3, fam: 'mkdir', dom: 'fs-dir', cmd: 'mkdir -p door_management_files/door_configuration', task: 'Создать директорию door_configuration вместе с родительской door_management_files', what: 'Создаёт директорию вместе с отсутствующими родительскими директориями', why: 'Флаг -p создаёт всю цепочку директорий и не падает, если часть уже существует.', hint: 'Цепочку директорий создаёт ключ -p, дальше — путь из двух уровней.' },
    { id: 'i-mkdir-map', day: 'd1', quest: 3, fam: 'mkdir', dom: 'fs-dir', cmd: 'mkdir -p door_management_files/door_map', task: 'Создать директорию door_map для карты дверей', what: 'Создаёт директорию door_map вместе с родительской', hint: 'Тот же ключ -p, что и для остальных директорий, и путь до door_map.' },
    { id: 'i-find-count', day: 'd1', quest: 3, fam: 'count', dom: 'find-count', cmd: 'find door_management_files -type f | wc -l', task: 'Посчитать общее количество файлов внутри door_management_files (ожидается 34)', what: 'Считает количество файлов внутри door_management_files: 34', why: '17 конфигураций + 16 логов + 1 карта = 34 файла.', hint: 'Две команды объединены конвейером |: поиск файлов и подсчёт строк.' },
    { id: 'i-find-keys', day: 'd2', quest: 6, fam: 'count', dom: 'find-count', cmd: 'find . -name "*.key" | wc -l', task: 'Посчитать все .key файлы в текущей директории (в выполненном варианте — 60)', what: 'Считает количество файлов с расширением .key', hint: 'Маску имени *.key лучше взять в кавычки, чтобы её раскрыла команда find.' },
    { id: 'i-find-list', day: 'd1', quest: 4, fam: 'find', dom: 'find-list', cmd: 'find door_management_files -type f', task: 'Показать структуру: все файлы внутри door_management_files', what: 'Выводит список всех файлов внутри door_management_files', hint: 'find с указанием директории и типа объекта -type f.' },
    { id: 'i-ps', day: 'd1', quest: 3, fam: 'ps', dom: 'proc-view', cmd: 'ps aux | grep ai_door', task: 'Найти работающий процесс AI-модуля', what: 'Показывает процессы, в описании которых встречается ai_door', hint: 'Процесс ищут в полном списке процессов, а результат фильтруют конвейером.' },
    { id: 'i-kill', day: 'd1', quest: 3, fam: 'kill', dom: 'proc-kill', cmd: 'kill 1513', task: 'Завершить процесс с найденным PID (например 1513)', what: 'Завершает процесс с указанным PID', why: '1513 — только пример; подставляется фактический PID из ps.', hint: 'Команда принимает только PID — в задании он приведён как пример.' },
    { id: 'i-commit-doors', day: 'd1', quest: 3, fam: 'git-commit', dom: 'git-commit', cmd: 'git commit -m "feat: complete door management and control quests"', task: 'Зафиксировать результат квестов управления дверями', what: 'Создаёт коммит с сообщением «feat: complete door management and control quests»', hint: 'Сообщение начинается с feat: и упоминает управление дверями.' },
    { id: 'i-add-dot', day: 'd1', quest: 2, fam: 'git-add', dom: 'git-index', cmd: 'git add .', task: 'Добавить в индекс все изменения сразу', what: 'Добавляет все изменения в индекс (staging area)', hint: 'Одна точка в качестве пути означает «всё сразу».' },
    { id: 'i-add-file', day: 'd2', quest: 7, fam: 'git-add', dom: 'git-index', cmd: 'git add ai_help/main-2.key', task: 'Добавить в индекс только новый файл main-2.key', what: 'Добавляет в индекс один конкретный файл', hint: 'В индекс попадает только один новый файл с ключом.' },

    // --- Quest 5 ---
    { id: 'i-vim', day: 'd2', quest: 5, fam: 'vim', dom: 'editor', cmd: 'vim door_management_files/door_configuration/door_1.conf', task: 'Открыть конфиг первой двери в редакторе Vim', what: 'Открывает файл конфигурации первой двери в редакторе Vim', hint: 'Нужно открыть файл в терминальном редакторе, указав полный путь к door_1.conf.' },
    { id: 'i-commit-door', day: 'd2', quest: 5, fam: 'git-commit', dom: 'git-commit', cmd: 'git commit -m "feat: open first door"', task: 'Зафиксировать открытие первой двери отдельным коммитом', what: 'Создаёт коммит с сообщением «feat: open first door»', hint: 'Сообщение короткое: feat: open first door.' },
    { id: 'i-status-open', day: 'd2', quest: 5, fam: 'out-status', dom: 'output', modes: ['what'], cmd: 'STATUS: OPEN', what: 'В файле door_1.conf дверь помечена как открытая', why: 'Значение параметра STATUS в door_1.conf приведено из CLOSED в OPEN.', hint: 'Значение параметра STATUS после правки в door_1.conf.' },
    { id: 'i-status-closed', day: 'd2', quest: 5, fam: 'out-status', dom: 'output', modes: ['what'], cmd: 'STATUS: CLOSED', what: 'Дверь в конфигурации закрыта — нужно менять на OPEN', hint: 'Исходное значение STATUS, которое нужно поменять на противоположное.' },
    { id: 'i-perm-line', day: 'd1', quest: 2, fam: 'out-perm', dom: 'output', modes: ['what'], cmd: '-rwxr-xr-x', what: 'Права файла: владелец может всё, группа и остальные — читать и выполнять', why: 'Буква x означает, что файл можно запускать.', hint: 'Три группы по три символа: владелец, группа и остальные.' },
    { id: 'i-branch-out', day: 'd1', quest: 1, fam: 'out-branch', dom: 'output', modes: ['what'], cmd: '* develop\n  master', what: 'Вывод git branch: текущая ветка — develop, рядом есть master', why: 'Звёздочка * отмечает текущую ветку.', hint: 'Звёздочка в выводе отмечает текущую ветку.' },
    { id: 'i-ok-out', day: 'd2', quest: 6, fam: 'out-ok', dom: 'output', modes: ['what'], cmd: 'Ok.', what: 'Ожидаемый результат работы unifier.sh после объединения ключей', hint: 'Скрипт печатает короткое подтверждение успеха с точкой.' },
    { id: 'i-694', day: 'd2', quest: 6, fam: 'out-key', dom: 'output', modes: ['what'], cmd: '694', what: 'Значение main.key в выполненном варианте задания', why: 'Значение зависит от вашего прогона — главное использовать main.key, созданный вашим unifier.sh.', hint: 'Трёхзначное число из выполненного варианта; главное — свой main.key.' },
    { id: 'i-ff', day: 'd2', quest: 7, fam: 'out-ff', dom: 'output', modes: ['what'], cmd: 'Fast-forward', what: 'Сообщение git merge: ветка просто перемотана вперёд, конфликтов нет', hint: 'Сообщение о том, что слияние прошло без конфликтов и новых коммитов.' },
    { id: 'i-tree', day: 'd1', quest: 3, fam: 'out-tree', dom: 'output', modes: ['what'], cmd: 'door_management_files/\n├── door_configuration/\n├── door_logs/\n└── door_map/', what: 'Ожидаемая структура директорий управления дверями в src', hint: 'Верхний уровень — директория с файлами управления дверями, внутри три поддиректории.' },

    // --- Quest 6-7 ---
    { id: 'i-run-unifier', day: 'd2', quest: 6, fam: 'run', dom: 'exec', cmd: './unifier.sh', task: 'Запустить объединение ключей в один main.key', what: 'Объединяет сгенерированные ключи; ожидаемый результат — Ok.', hint: 'Запуск из текущей директории, затем имя скрипта-объединителя.' },
    { id: 'i-cp-key2', day: 'd2', quest: 7, fam: 'cp', dom: 'fs-copy', cmd: 'cp ai_help/main.key ai_help/main-2.key', task: 'Скопировать основной ключ в файл main-2.key', what: 'Копирует файл: источник → назначение (main.key становится main-2.key)', hint: 'cp принимает источник и назначение, оба пути лежат в ai_help.' },
    { id: 'i-cp-key3', day: 'd2', quest: 7, fam: 'cp', dom: 'fs-copy', cmd: 'cp ai_help/main.key ai_help/main-3.key', task: 'Скопировать основной ключ в файл main-3.key в ветке feature/3-key', what: 'Копирует ключ в третий файл main-3.key', hint: 'Скопировать нужно тот же main.key, но в файл с номером 3.' },
    { id: 'i-commit-key2', day: 'd2', quest: 7, fam: 'git-commit', dom: 'git-commit', cmd: 'git commit -m "key-branch: add main-2.key"', task: 'Закоммитить main-2.key с именем ветки в начале сообщения', what: 'Создаёт коммит «key-branch: add main-2.key»', why: 'По условию название ветки должно стоять в начале сообщения коммита.', hint: 'Название ветки key-branch должно стоять в самом начале сообщения коммита.' },
    { id: 'i-commit-key3', day: 'd2', quest: 7, fam: 'git-commit', dom: 'git-commit', cmd: 'git commit -m "feature/3-key: add main-3.key"', task: 'Закоммитить main-3.key с именем ветки feature/3-key в начале сообщения', what: 'Создаёт коммит «feature/3-key: add main-3.key»', hint: 'В начале сообщения — имя ветки feature/3-key.' },
    { id: 'i-merge', day: 'd2', quest: 7, fam: 'git-merge', dom: 'git-merge', cmd: 'git merge feature/3-key', task: 'Влить ветку feature/3-key в текущую (ожидается Fast-forward)', what: 'Вливает ветку feature/3-key в текущую ветку', hint: 'Сейчас активна key-branch, поэтому вливается в неё ветка feature/3-key.' },
    { id: 'i-log', day: 'd2', quest: 7, fam: 'git-log', dom: 'git-log', cmd: 'git log --oneline --graph --all --decorate -10', task: 'Посмотреть историю коммитов графом по всем веткам (последние 10)', what: 'Печатает историю коммитов графом по всем веткам с метками, последние 10 записей', hint: 'Нужны сразу несколько ключей и ограничение на количество коммитов.' },
    { id: 'i-push', day: 'd2', quest: 7, fam: 'git-push', dom: 'git-remote-push', cmd: 'git push origin develop', task: 'Отправить ветку develop в удалённый репозиторий origin', what: 'Отправляет ветку develop на origin', hint: 'После git push указывается удалённый репозиторий origin и имя ветки.' },
    { id: 'i-push-force', day: 'd2', quest: 7, fam: 'git-push', dom: 'git-danger', modes: ['what'], cmd: 'git push --force', what: 'Принудительно перезаписывает историю удалённой ветки — в задании так делать запрещено', hint: 'Ключ --force перезаписывает историю удалённой ветки — в задании так делать запрещено.' },

    // --- Bonus ---
    { id: 'i-sha', day: 'bonus', quest: 8, fam: 'sha', dom: 'hash', cmd: 'sha256sum src/history_of_vim.txt', task: 'Получить sha-сумму файла для записи в files.log', what: 'Считает sha-сумму файла и печатает её с именем файла', why: 'Алгоритм sha нужно указать в записи журнала вместе с суммой.', hint: 'Сумму считает sha256sum, аргумент — путь к файлу.' },
    { id: 'i-size', day: 'bonus', quest: 8, fam: 'stat', dom: 'meta', cmd: 'stat -c "%s" src/history_of_vim.txt', task: 'Узнать размер файла в байтах для журнала', what: 'Печатает размер файла в байтах', hint: 'Размер в байтах печатает stat с форматом %s.' },
    { id: 'i-date', day: 'bonus', quest: 8, fam: 'date', dom: 'meta-time', cmd: 'date "+%Y-%m-%d %H:%M:%S"', task: 'Получить дату и время для записи в журнал', what: 'Печатает текущую дату и время в заданном формате', hint: 'Дата выводится в формате ГГГГ-ММ-ДД ЧЧ:ММ:СС через ключ +%.' },
    { id: 'i-log-cat', day: 'bonus', quest: 8, fam: 'log', dom: 'log-view', cmd: 'cat src/files.log', task: 'Показать содержимое журнала изменений файлов', what: 'Выводит журнал src/files.log: путь — размер — дата и время — sha-сумма — алгоритм', hint: 'Журнал изменений — обычный текстовый файл, его можно просто вывести.' },
    { id: 'i-edit-sh', day: 'bonus', quest: 9, fam: 'edit', dom: 'script-run', cmd: './edit.sh history_of_vim.txt "Vim 6.0" "Vim 7.0"', task: 'Запустить собственный скрипт замены строки: файл, что искать, на что заменить', what: 'Запускает скрипт замены с тремя аргументами: путь к файлу, строка поиска, строка замены', why: 'Порядок аргументов важен: файл → что искать → на что заменить.', hint: 'Три аргумента строго по порядку: файл, строка поиска, строка замены.' },
  ]
};
